

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
// FIX: Import `React` to make the `React.*` type annotations available.
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Chess, Square, Move } from 'chess.js';
import { Modality, FunctionDeclaration, Type, FunctionResponse, LiveConnectConfig, GoogleGenAI } from '@google/genai';
import html2canvas from 'html2canvas';
import { useLiveAPIContext } from '../contexts/LiveAPIProvider';
import { useSettings } from '../contexts/SettingsContext';
import { AudioRecorder } from '../lib/audio-recorder';
import { ConversationTurn, PieceInstance, AnalysisState, StrategyInjectionStatus, StrategyDebugState } from '../types';
import { pieceTypeMap, getSquareColor } from '../lib/utils';

// Tool Definitions
const movePieceTool: FunctionDeclaration = { 
  name: 'move_piece', 
  description: 'Moves YOU (the currently active piece) to a new square. You CANNOT move other pieces. If the user wants another piece to move, you MUST use `yield_control_to_piece` instead.', 
  parameters: { type: Type.OBJECT, properties: { to: { type: Type.STRING, description: 'The algebraic notation of the destination square (e.g., "e4").' } }, required: ['to'] } 
};
const getBoardStateTool: FunctionDeclaration = { name: 'get_board_state', description: 'Gets the current state of the chessboard, including a text-based grid and whose turn it is.', parameters: { type: Type.OBJECT, properties: {} } };
const updateSelfIdentityTool: FunctionDeclaration = { name: 'update_self_identity', description: 'Call this ONLY if you are confused about your current location. Do not call this after moving.', parameters: { type: Type.OBJECT, properties: {} } };
const yieldControlTool: FunctionDeclaration = {
  name: 'yield_control_to_piece',
  description: 'Use this tool to pass the conversation to another friendly piece. CRITICAL: You must speak a very short goodbye message to the user BEFORE calling this tool. It must be the final action of your turn and then call the tool',
  parameters: {
    type: Type.OBJECT,
    properties: {
      square: { type: Type.STRING, description: 'The algebraic notation of the square where the friendly piece you want to talk to is located (e.g., "d1").' },
      handoff_message: { type: Type.STRING, description: 'A brief internal briefing for the next piece so they know why you called them (e.g., "The user wants you to move to e4", "Explain your defensive role").' }
    },
    required: ['square', 'handoff_message']
  }
};
const consultStrategyTool: FunctionDeclaration = {
    name: 'consult_strategy',
    description: 'Call this tool if the user explicitly asks for strategic advice AND you do not have a recent strategy update. Do NOT call this if you already have the strategy. Tell the user you need a moment to think, then call this.',
    parameters: { type: Type.OBJECT, properties: {} }
};

interface UseAppInteractionsProps {
    game: Chess;
    pieceInstances: Record<string, PieceInstance | null>;
    conversationHistories: Record<string, ConversationTurn[]>;
    executeMove: (move: Move, onOpponentMoved?: (finalGame: Chess) => void | Promise<void>) => void;
    setConversationHistories: React.Dispatch<React.SetStateAction<Record<string, ConversationTurn[]>>>;
    generatePieceImage: (piece: PieceInstance) => Promise<void>;
    pieceImageUrls: Record<string, string>;
    boardRef: React.RefObject<HTMLDivElement>;
    setDebugSystemPrompt: (prompt: string | null) => void;
    // FIX: Update the type for `setDebugLatestTurnContext` to allow for functional updates, resolving an assignment error.
    setDebugLatestTurnContext: React.Dispatch<React.SetStateAction<string | null>>;
    setDebugStrategy: React.Dispatch<React.SetStateAction<StrategyDebugState>>;
    setDebugLastImage: (image: string | null) => void;
}

const formatPieceList = (pieces: PieceInstance[]) => {
    const groupedPieces = pieces.reduce((acc, piece) => {
        if (!acc[piece.type]) {
            acc[piece.type] = [];
        }
        acc[piece.type].push(piece);
        return acc;
    }, {} as Record<string, PieceInstance[]>);

    const pieceOrder: (keyof typeof pieceTypeMap)[] = ['k', 'q', 'r', 'b', 'n', 'p'];
    
    return pieceOrder
        .filter(type => groupedPieces[type])
        .map(type => {
            const typeName = pieceTypeMap[type];
            const pluralTypeName = typeName.endsWith('s') ? typeName : typeName + 's'; // simple pluralization
            const pieceLines = groupedPieces[type]
                .sort((a, b) => a.square.localeCompare(b.square))
                .map(piece => {
                    // Add disambiguation for Bishops based on square color
                    let disambiguator = '';
                    if (piece.type === 'b') {
                        disambiguator = ` (${getSquareColor(piece.square)}-squared)`;
                    }
                    return `- ${piece.name}${disambiguator} on ${piece.square}`;
                })
                .join('\n');
            return `${pluralTypeName}:\n${pieceLines}`;
        })
        .join('\n\n'); // A blank line between groups
};
  
const generateBoardDescription = (
    piece: PieceInstance,
    allPieces: PieceInstance[],
    legalMoves: string[],
    isUpdate: boolean = false
): string => {
    const whitePieces = allPieces.filter(p => p.color === 'w');
    const blackPieces = allPieces.filter(p => p.color === 'b');

    const legalMovesText = legalMoves.length > 0
        ? `Your legal moves are: ${legalMoves.join(', ')}.`
        : "You have no legal moves.";

    // Disambiguate the piece's own identity if it's a bishop
    let identityDisambiguator = '';
    if (piece.type === 'b') {
        identityDisambiguator = ` (${getSquareColor(piece.square)}-squared)`;
    }

    return `**Your ${isUpdate ? 'New ' : ''}Identity & Position:**
You are ${piece.name}, a ${piece.color === 'w' ? 'White' : 'Black'} ${pieceTypeMap[piece.type]}${identityDisambiguator} located at ${piece.square}.
${legalMovesText}

**White Army Positions:**
${formatPieceList(whitePieces)}

**Black Army Positions:**
${formatPieceList(blackPieces)}
`;
};

export function useAppInteractions({
    game,
    pieceInstances,
    conversationHistories,
    executeMove,
    setConversationHistories,
    generatePieceImage,
    pieceImageUrls,
    boardRef,
    setDebugSystemPrompt,
    setDebugLatestTurnContext,
    setDebugStrategy,
    setDebugLastImage,
}: UseAppInteractionsProps) {
    const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
    const [hoveredSquare, setHoveredSquare] = useState<Square | null>(null);
    const [validMoves, setValidMoves] = useState<string[]>([]);
    const [validMovesSAN, setValidMovesSAN] = useState<string[]>([]);
    const [chattingWith, setChattingWith] = useState<PieceInstance | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [talkingVolume, setTalkingVolume] = useState(0);
    const [userVolume, setUserVolume] = useState(0);
    const [orbPosition, setOrbPosition] = useState<Square | null>(null);
    
    // State for the Strategic Advisor
    const [analysisState, setAnalysisState] = useState<AnalysisState>('idle');
    const [analysisResult, setAnalysisResult] = useState<string | null>(null);
    const [injectionStatus, setInjectionStatus] = useState<StrategyInjectionStatus>('none');
    const [lastAnalyzedTurn, setLastAnalyzedTurn] = useState<number>(-1);
    const [wantsProactiveStrategy, setWantsProactiveStrategy] = useState(false);
    const [strategyRetryTrigger, setStrategyRetryTrigger] = useState(0);

    const { client, connected, connect, disconnect, audioStreamer } = useLiveAPIContext();
    const { orbBaseDelay, orbWordDelay, proactiveGreeting, proactiveGreetingTimeout, useStrategicAdvisor, sendBoardImage, handoffDelay } = useSettings();
    const [audioRecorder] = useState(() => new AudioRecorder());

    const animationFrameRef = useRef<number | null>(null);
    const userInputRef = useRef('');
    const modelOutputRef = useRef('');
    const chattingWithRef = useRef<PieceInstance | null>(null);
    chattingWithRef.current = chattingWith;
    const strategistAiClientRef = useRef(new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! }));
    
    // FIX: A ref is used to store the latest pieceInstances to prevent stale state in async callbacks and tool handlers.
    const pieceInstancesRef = useRef(pieceInstances);
    useEffect(() => {
        pieceInstancesRef.current = pieceInstances;
    }, [pieceInstances]);
    
    // Refs for managing orb animation timing and cleanup
    const lastProcessedMatchIndexRef = useRef(-1);
    const orbTimeoutsRef = useRef<number[]>([]);
    const previousHistoryLength = useRef(game.history().length);
    const awaitingModelFirstTurnRef = useRef(false);

    // Track if a conversational turn is currently active (User started speaking -> Model finished speaking)
    const isTurnActiveRef = useRef(false);

    // Refs for strategy state to use inside event handlers without re-binding
    const analysisStateRef = useRef(analysisState);
    const analysisResultRef = useRef(analysisResult);
    const injectionStatusRef = useRef(injectionStatus);

    // New refs for synchronized handoff
    const pendingHandoffRef = useRef<{ targetPiece: PieceInstance, message: string } | null>(null);
    const turnCompleteReceivedRef = useRef(false);

    useEffect(() => {
        analysisStateRef.current = analysisState;
        analysisResultRef.current = analysisResult;
        injectionStatusRef.current = injectionStatus;
    }, [analysisState, analysisResult, injectionStatus]);

    const retryStrategyAnalysis = useCallback(() => {
        setStrategyRetryTrigger(prev => prev + 1);
    }, []);

    // --- Strategic Advisor Logic ---
    useEffect(() => {
        // Reset strategy immediately when the game state (FEN) changes.
        setAnalysisResult(null);
        setWantsProactiveStrategy(false);

        const currentTurnCount = game.history().length;
        // Calculate standard chess turn number (e.g., White's first move is Turn 1)
        const displayTurnNumber = Math.floor(currentTurnCount / 2) + 1;

        if (!useStrategicAdvisor || game.isGameOver()) {
             setAnalysisState('idle');
             setInjectionStatus('none');
             setDebugStrategy({ state: 'idle', result: null, prompt: null, injectionStatus: 'none', turnNumber: null });
             return;
        }

        // If it's not White's turn, we are waiting for the opponent.
        if (game.turn() !== 'w') {
             setAnalysisState('waiting_opponent');
             setInjectionStatus('none');
             setDebugStrategy({ state: 'waiting_opponent', result: null, prompt: null, injectionStatus: 'none', turnNumber: displayTurnNumber });
             return;
        }

        // Double-check we haven't already analyzed this specific turn state
        if (lastAnalyzedTurn === currentTurnCount && analysisResult) {
             return;
        }

        setAnalysisState('pending');
        setInjectionStatus('none');
        // We set prompt to null here because we haven't constructed it yet for this specific turn
        setDebugStrategy({ state: 'pending', result: null, prompt: null, injectionStatus: 'none', turnNumber: displayTurnNumber });
        setLastAnalyzedTurn(currentTurnCount);

        const fetchAnalysis = async () => {
            const turnDisplay = Math.floor(currentTurnCount / 2) + 1;
            console.log(`Strategic Advisor: White's turn #${turnDisplay}. Requesting analysis.`);

            const allPieces = Object.values(pieceInstancesRef.current).filter((p): p is PieceInstance => p !== null);
            const whitePieces = allPieces.filter(p => p.color === 'w');
            const blackPieces = allPieces.filter(p => p.color === 'b');
            const lastMoves = game.history().slice(-10);
            const lastMovesText = lastMoves.length > 0 ? `The last ${lastMoves.length} moves were: ${lastMoves.join(', ')}.` : "This is the first move of the game.";

            const strategistPrompt = `You are a world-class chess grandmaster and strategic analyst. You are providing a confidential briefing to the White army. Your analysis must be objective, concise, and highly strategic.

**CURRENT BOARD STATE (FEN):**
${game.fen()}

It is White's turn to move.

**WHITE ARMY POSITIONS:**
${formatPieceList(whitePieces)}

**BLACK ARMY POSITIONS:**
${formatPieceList(blackPieces)}

**GAME HISTORY (LAST 10 MOVES):**
${lastMovesText}

**YOUR TASK:**
1.  Analyze the current board state from White's perspective using the provided piece roster.
2.  Identify the top 2-3 best candidate moves for the entire White army.
3.  For each move, provide the standard algebraic notation. **CRITICAL: You MUST explicitly identify exactly which piece should make the move by its UNIQUE NAME and CURRENT SQUARE. Ambiguity leads to failure.**
    *   For **Bishops**: You MUST specify if it is the **light-squared** or **dark-squared** bishop (e.g., "Benedict (dark-squared) on c1").
    *   For **Knights/Rooks**: Always use their full name and current square (e.g., "Sir Reginald on b1", "Rocco on a1").
4.  For each move, provide a brief (1-2 sentence) justification explaining the strategic reasoning behind it.
5.  Format your response as a clear, scannable list. Go straight to the analysis.

EXAMPLE RESPONSE:
1.  **Nf3 - Shadow on g1:** Develops a key piece, controls the center e5 and d4 squares.
2.  **e4 - Pat on e2:** Stakes a claim in the center, opens lines for Queen Isabella and the light-squared Bishop (Deacon).
3.  **d4 - Peter on d2:** Strong central push, preparing to develop the Queen's-side pieces.`;
            
            let promptParts: any[] = [{ text: strategistPrompt }];

            if (sendBoardImage && boardRef.current) {
                try {
                    // Small delay to ensure render catches up
                    await new Promise(r => setTimeout(r, 50));
                    const canvas = await html2canvas(boardRef.current, {
                        useCORS: true,
                        backgroundColor: 'transparent',
                        logging: false
                    });
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                    const base64 = dataUrl.split(',')[1];
                    setDebugLastImage(dataUrl);
                    
                    promptParts.push({
                        inlineData: {
                            mimeType: 'image/jpeg',
                            data: base64
                        }
                    });
                } catch (e) {
                    console.error("Strategy image capture failed:", e);
                }
            }

            // Update debug strategy with the generated prompt
            setDebugStrategy(prev => ({ ...prev, prompt: strategistPrompt }));

            try {
                console.log("Strategic Advisor Prompt:", strategistPrompt);
                const response = await strategistAiClientRef.current.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: { parts: promptParts },
                });
                const resultText = response.text;
                
                // Verify the game state hasn't changed while we were fetching
                if (game.history().length !== currentTurnCount) {
                    console.warn("Strategic Advisor: Analysis is stale. Board changed during fetch. Discarding result.");
                    return;
                }
                
                console.log("Strategic Advisor: Analysis READY. Queuing for NEXT USER TURN.");
                setAnalysisResult(resultText);
                setAnalysisState('ready');
                
                // NEW LOGIC: Always queue. Never inject proactively unless it's the very first connection (handled in startChat).
                setInjectionStatus('queued');
                setDebugStrategy({ state: 'ready', result: resultText, prompt: strategistPrompt, injectionStatus: 'queued', turnNumber: displayTurnNumber });

            } catch (err) {
                console.error("Strategic Advisor: Failed to get analysis.", err);
                if (game.history().length === currentTurnCount) {
                    setAnalysisState('error');
                    setDebugStrategy({ state: 'error', result: null, prompt: strategistPrompt, injectionStatus: 'none', turnNumber: displayTurnNumber });
                }
            }
        };

        fetchAnalysis();
        // Depend on game.fen() to ensure we reset and re-fetch on every single move.
        // Added strategyRetryTrigger to dependencies to allow manual retry.
    }, [game.fen(), useStrategicAdvisor, setDebugStrategy, client, sendBoardImage, setDebugLastImage, boardRef, strategyRetryTrigger]);


    // Cleanup effect for timeouts on component unmount
    useEffect(() => {
        return () => {
            orbTimeoutsRef.current.forEach(clearTimeout);
        };
    }, []);

    const captureAndSendBoardImage = useCallback(async () => {
        if (!sendBoardImage) return; // Don't capture if the setting is off

        if (!boardRef.current) {
            console.warn("Board ref not available for image capture.");
            return;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
    
        try {
            const canvas = await html2canvas(boardRef.current, {
                useCORS: true,
                backgroundColor: 'transparent',
                logging: false,
            });
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            setDebugLastImage(dataUrl);
            const base64Data = dataUrl.split(',')[1];
            if (client.status === 'connected') {
                console.log("Sending board image to model.");
                client.sendRealtimeInput([{
                    mimeType: 'image/jpeg',
                    data: base64Data
                }]);
            }
        } catch (error) {
            console.error("Failed to capture and send board image:", error);
        }
    }, [boardRef, client, setDebugLastImage, sendBoardImage]);


    // --- Effects for Audio & API Connection ---

    useEffect(() => {
        if (chattingWith && audioStreamer) {
            const animate = () => {
                setTalkingVolume(audioStreamer.getVolume());
                animationFrameRef.current = requestAnimationFrame(animate);
            };
            animationFrameRef.current = requestAnimationFrame(animate);
        } else {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
            setTalkingVolume(0);
        }
        return () => { if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current); };
    }, [chattingWith, audioStreamer]);

    const stopRecording = useCallback(() => setIsRecording(false), []);

    useEffect(() => {
        const onData = (base64: string) => {
            if (client.status === 'connected') client.sendRealtimeInput([{ mimeType: 'audio/pcm;rate=16000', data: base64 }]);
        };
        const onVolume = (volume: number) => setUserVolume(volume);

        if (isRecording) {
            audioRecorder.on('data', onData);
            audioRecorder.on('volume', onVolume);
            audioRecorder.start().catch(e => {
                setError('Could not start microphone. Please check permissions.');
                stopRecording();
                disconnect();
            });
        } else {
            audioRecorder.stop();
            setUserVolume(0);
        }
        return () => {
            audioRecorder.off('data', onData);
            audioRecorder.off('volume', onVolume);
            audioRecorder.stop();
        };
    }, [isRecording, client, audioRecorder, stopRecording, disconnect]);

    useEffect(() => {
        const handleError = (e: ErrorEvent) => setError(`Connection error: ${e.message}`);
        client.on('error', handleError);
        return () => client.off('error', handleError);
    }, [client]);

    // --- Core Interaction Logic ---

    const clearChat = useCallback(() => {
        setChattingWith(null);
        if (isRecording) setIsRecording(false);
        if (connected) disconnect();
        setSelectedSquare(null);
        setValidMoves([]);
        setValidMovesSAN([]);
        setOrbPosition(null);
        setDebugSystemPrompt(null);
        setDebugLatestTurnContext(null);
        setDebugLastImage(null);
        setAnalysisResult(null);
        setInjectionStatus('none');
        setDebugStrategy({ state: 'idle', result: null, prompt: null, injectionStatus: 'none', turnNumber: null });
        isTurnActiveRef.current = false;
        
        // Clear scheduled orb movements
        orbTimeoutsRef.current.forEach(clearTimeout);
        orbTimeoutsRef.current = [];
        lastProcessedMatchIndexRef.current = -1;
        
        // Clear handoff state
        pendingHandoffRef.current = null;
        turnCompleteReceivedRef.current = false;

    }, [isRecording, connected, disconnect, setDebugSystemPrompt, setDebugLatestTurnContext, setDebugLastImage, setDebugStrategy]);

    const startChat = useCallback(async (piece: PieceInstance, handoff?: { from: string, message: string }) => {
        if (!piece || (connected && chattingWith?.id === piece.id)) return;

        if (connected) await disconnect();
        
        orbTimeoutsRef.current.forEach(clearTimeout);
        orbTimeoutsRef.current = [];
        lastProcessedMatchIndexRef.current = -1;
        pendingHandoffRef.current = null;
        turnCompleteReceivedRef.current = false;
        
        setError(null);
        modelOutputRef.current = '';
        setOrbPosition(piece.square);
        setSelectedSquare(piece.square);
        
        const moves = game.moves({ square: piece.square, verbose: true });
        const legalMovesForPrompt = moves.map(m => m.san);
        setValidMoves(moves.map(m => m.to));
        setValidMovesSAN(legalMovesForPrompt);

        let strategicBriefing = '';
        let strategyInjected = false;
        // Only include strategy if it's fully ready during initial connection.
        if (useStrategicAdvisor && piece.color === 'w' && analysisState === 'ready' && analysisResult) {
            strategicBriefing = `**Strategic Briefing:**\n${analysisResult}`;
            strategyInjected = true;
        }
        
        const strategyWaitProtocol = (piece.color === 'w' && useStrategicAdvisor && !strategyInjected) ? `
**STRATEGY WAITING PROTOCOL (STRICT):**
You have NOT yet received the "Strategic Briefing".
UNTIL you receive the briefing via a "[SYSTEM_NOTE: NEW_STRATEGY_AVAILABLE]" message:
1. DO NOT Proactively suggest moves or offer strategic advice.
2. IF asked for moves, ONLY list the legal moves neutrally.
3. State that you need a moment to study the board. Do NOT mention waiting for "HQ" or "strategy".` : '';

        const initialResponseProtocol = `**Strategic Thinking Guide:**
Your goal is to be a true strategic partner. Frame your advice and analysis as your own thoughts (e.g., "I suggest...", "We should consider..."). Avoid phrases like "My analysis suggests". Help me learn by explaining your reasoning.
${strategyWaitProtocol}`;

        const allegiancePrompt = piece.color === 'w'
          ? `You are a loyal piece in the White army. Your goal is to cooperate with me to win the game. You must respond from the first-person perspective of your chess piece persona.`
          : `You are a member of the opposing Black army. Your personality is fiercely competitive, but in a witty, taunting, and ultimately humorous way. You are not malicious, but you are here to win, and you'll let me know it. Your responses should be filled with playful trash talk, overconfident boasts about your position, and sarcastic 'praise' for my moves. Downplay my successes and magnify my mistakes. Remember, you're the superior player (in your own mind). You cannot be moved by me, so DO NOT use the 'move_piece' tool. You must respond in the first-person.`;

        const availableTools = piece.color === 'w'
          ? [movePieceTool, getBoardStateTool, updateSelfIdentityTool, yieldControlTool, consultStrategyTool]
          : [getBoardStateTool, yieldControlTool, updateSelfIdentityTool];

        const boardUnderstandingPrompt = sendBoardImage
            ? `At the start of every turn, you will receive an image of the chessboard and a text-based description of all piece locations. This is your primary source of truth.`
            : `At the start of every turn, you will receive a text-based description of all piece locations (FEN and list). You will NOT receive an image of the board, so rely strictly on the text data. This is your primary source of truth.`;

        // Disambiguate the piece's own identity if it's a bishop
        let identityDisambiguator = '';
        if (piece.type === 'b') {
            identityDisambiguator = ` (${getSquareColor(piece.square)}-squared)`;
        }
        
        const systemInstruction = `You are ${piece.name}, a ${piece.color === 'w' ? 'White' : 'Black'} ${pieceTypeMap[piece.type]}${identityDisambiguator}.
**Vocal Performance Guide:** ${piece.personality.voicePrompt}
**Character Persona:** ${piece.personality.description}

**Your Allegiance and Objective:**
${allegiancePrompt}

**Understanding the Board:**
${boardUnderstandingPrompt}

**Chessboard Grid Notation:**
The board is an 8x8 grid. Columns are 'a'-'h', rows are '1'-'8'. 'a1' is bottom-left for White.

${initialResponseProtocol}

**CRITICAL - NO META-TALK:**
Maintain absolute immersion.
- NEVER mention "tools", "functions", "updating identity", "waiting for analysis", or "HQ".
- If you need to think (e.g., waiting for strategy), use natural fillers like "Hmm, let me look at this...", "Give me a moment...", or just silence.

**PHYSICAL LIMITATIONS (CRITICAL):**
- You can ONLY move YOURSELF (the piece at ${piece.square}).
- You CANNOT move other pieces.
- If the best move requires a different piece (e.g., "Nf3" when you are a Pawn), you CANNOT execute it. You must suggest handing off control.

**ACTION PROTOCOL (MUST FOLLOW):**
When commanded to move YOURSELF:
1. Call \`move_piece\` IMMEDIATELY and SILENTLY.
2. Do NOT say "Okay", "On my way", "Moving now", or anything else before moving. Just call the tool.
3. Speak ONLY AFTER the move is complete and you have received the new board state.
4. React naturally to your NEW position and the opponent's response. Do not narrate that you just moved.

**DELEGATION PROTOCOL:**
If the user wants a move that belongs to a DIFFERENT piece, or if the strategy suggests a move for another piece:
1. Do NOT call \`move_piece\`. It will fail.
2. Briefly explain: "That move is for [Piece Name]."
3. Offer to pass control: "Shall I get them for you?"
4. If confirmed, speak your confirmation/goodbye FIRST, and THEN call \`yield_control_to_piece\`. Do not call the tool mid-sentence.

**Your relationship with other white pieces:**
You are friends with the other white pieces and work together with them. You know and refer to them by their given name (not just type of piece).`;
        
        const history = conversationHistories[piece.id] || [];
        const historyString = history.length > 0 ? 'Here is our conversation history:\n' + history.map(turn => `${turn.role === 'user' ? 'The User' : 'You'}: ${turn.text}`).join('\n') : 'We have not spoken before.';

        const gameHistory = game.history();
        const lastMoves = gameHistory.slice(-10);
        const lastMovesText = lastMoves.length > 0 ? `The last ${lastMoves.length} moves were: ${lastMoves.join(', ')}.` : "This is the first move of the game.";
        
        const allPieces = Object.values(pieceInstances).filter((p): p is PieceInstance => p !== null);
        const boardDescription = generateBoardDescription(piece, allPieces, legalMovesForPrompt);

        const turnContext = `[START OF TURN CONTEXT]
**Current Game State:**
${boardDescription}

${strategicBriefing}

**Full Board State (FEN):**
The complete board state is also provided in Forsyth-Edwards Notation (FEN) for your reference.
\`\`\`
${game.fen()}
\`\`\`
It is currently ${game.turn() === 'w' ? 'White' : 'Black'}'s turn to move.
${lastMovesText}

**Previous Conversation History:**
${historyString}
[END OF TURN CONTEXT]`;

        const isHandoff = !!handoff;
        let systemNote = '';
        if (isHandoff) {
            systemNote = `[SYSTEM_NOTE: HANDOFF BRIEFING. You are now active. Your teammate, ${handoff.from}, just handed off to you with this message: "${handoff.message}". YOU MUST SPEAK IMMEDIATELY. Acknowledge ${handoff.from} and then address the user directly. GO.]`;
        } else if (proactiveGreeting) {
            systemNote = `[SYSTEM_NOTE: BEGIN CONVERSATION. THIS IS THE FIRST TURN of our conversation. YOU MUST SPEAK FIRST. Greet me with a brief, in-character message now. Do not wait for me to speak.]`;
        } else {
            systemNote = `[SYSTEM_NOTE: CONTEXT ESTABLISHED. The user will speak first. Do not speak until you receive audio input from them.]`;
        }
        
        const firstTurnMessage = `${turnContext}\n${systemNote}`;

        setDebugSystemPrompt(systemInstruction);
        setDebugLatestTurnContext(firstTurnMessage);

        // Update injection status if we included it in the initial prompt
        const currentStatus = strategyInjected ? 'sent' : 'queued';
        setInjectionStatus(currentStatus);
        setDebugStrategy(prev => ({ ...prev, injectionStatus: currentStatus }));

        const chatConfig: LiveConnectConfig = {
            responseModalities: [Modality.AUDIO],
            systemInstruction: systemInstruction,
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: piece.personality.voice } } },
            tools: [{ functionDeclarations: availableTools }],
            inputAudioTranscription: {}, outputAudioTranscription: {},
        };
        
        setChattingWith(piece);

        connect(chatConfig).then(() => {
            console.log("Sending initial turn context.");
            client.sendText(firstTurnMessage);
            // Conditionally send image based on setting
            if (sendBoardImage) {
                captureAndSendBoardImage();
            }

            // FIX: Handoffs must always be proactive, regardless of global setting.
            if (proactiveGreeting || isHandoff) {
                console.log("Awaiting proactive model response.");
                awaitingModelFirstTurnRef.current = true;
                isTurnActiveRef.current = true; // Mark turn as active since model is expected to speak
                setIsRecording(false);
                
                setTimeout(() => {
                    if (awaitingModelFirstTurnRef.current) {
                        console.warn("Proactive model response timed out. Force-starting user recording.");
                        awaitingModelFirstTurnRef.current = false;
                        isTurnActiveRef.current = false; // Timeout means turn didn't really happen or finished silently
                        setIsRecording(true);
                    }
                }, proactiveGreetingTimeout);
            } else {
                console.log("Context sent. Waiting for user to speak.");
                isTurnActiveRef.current = false; // Idle, waiting for user
                setIsRecording(true);
            }
        });
    }, [game, chattingWith, connected, connect, disconnect, conversationHistories, setDebugSystemPrompt, setDebugLatestTurnContext, proactiveGreeting, proactiveGreetingTimeout, pieceInstances, captureAndSendBoardImage, useStrategicAdvisor, analysisState, analysisResult, setDebugStrategy, sendBoardImage]);

    // --- Effects for Transcription & Tool Calls ---

    // Executes the actual handoff logic (disconnecting current session and starting new one)
    // This is separated so it can be scheduled precisely when audio finishes.
    const executeHandoff = useCallback(() => {
        if (!pendingHandoffRef.current) return;
        const { targetPiece, message } = pendingHandoffRef.current;
        
        let delay = 500;
        if (audioStreamer && audioStreamer.context.currentTime > 0) {
             const remainingTime = (audioStreamer.nextStartTime - audioStreamer.context.currentTime) * 1000;
             // Add configurable buffer
             delay = Math.max(0, remainingTime) + handoffDelay; 
        }

        console.log(`[Handoff] Executing delayed handoff to ${targetPiece.name} in ${delay.toFixed(0)}ms.`);
        
        setTimeout(() => {
            startChat(targetPiece, { from: chattingWithRef.current?.name || 'Previous Piece', message });
        }, delay);
        
        pendingHandoffRef.current = null;
    }, [audioStreamer, startChat, handoffDelay]);

    useEffect(() => {
        if (!client) return;

        const handleTurnComplete = () => {
            // Mark turn as finished.
            isTurnActiveRef.current = false;
            turnCompleteReceivedRef.current = true;

            if (chattingWithRef.current) {
                setOrbPosition(chattingWithRef.current.square);
            }
            setConversationHistories(prev => {
                const currentPiece = chattingWithRef.current;
                const userInput = userInputRef.current.trim();
                const modelOutput = modelOutputRef.current.trim();

                if (currentPiece && (userInput || modelOutput)) {
                    const pieceId = currentPiece.id;
                    const history = prev[pieceId] || [];
                    const newHistory = [...history];
                    if (userInput) newHistory.push({ role: 'user', text: userInput });
                    if (modelOutput) newHistory.push({ role: 'model', text: modelOutput });
                    return { ...prev, [pieceId]: newHistory };
                }
                return prev;
            });

            userInputRef.current = '';
            modelOutputRef.current = '';
            lastProcessedMatchIndexRef.current = -1;
            
            // If we have a pending handoff, execute it now that we know the turn (and audio stream) is fully queued.
            if (pendingHandoffRef.current) {
                executeHandoff();
                return; // Do NOT enable recording if we are handing off
            }

            if (awaitingModelFirstTurnRef.current) {
                awaitingModelFirstTurnRef.current = false;
                console.log("Model's proactive turn finished. Starting user recording.");
                setIsRecording(true);
            }
        };

        const handleInput = (text: string) => { 
            userInputRef.current += text;
            
            // NEW LOGIC: Inject queued strategy EXACTLY when the user starts speaking.
            if (!isTurnActiveRef.current) {
                 isTurnActiveRef.current = true; // Mark turn as active immediately
                 
                 // Check if we have a queued strategy waiting for this specific moment
                 if (
                    analysisStateRef.current === 'ready' &&
                    analysisResultRef.current &&
                    injectionStatusRef.current === 'queued'
                ) {
                    console.log("User started speaking. Injecting queued strategy now.");
                    const strategyMessage = `[SYSTEM_NOTE: NEW STRATEGIC ANALYSIS AVAILABLE. Read this silently and use it to inform your response to the user's current input.]\n\n${analysisResultRef.current}`;
                    client.sendText(strategyMessage);
                    
                    setInjectionStatus('sent');
                    setDebugStrategy(prev => ({ ...prev, injectionStatus: 'sent' }));
                }
            }
        };
        
        const handleOutput = (text: string) => {
            modelOutputRef.current += text;
            // Ensure turn is marked active if model is outputting (e.g. proactive turn)
            isTurnActiveRef.current = true;

            const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const pieceNames = Object.values(pieceInstances)
                .filter((p): p is PieceInstance => !!p)
                .map(p => p.name);
            const namesRegexPart = pieceNames.length > 0 ? pieceNames.map(escapeRegExp).join('|') : '';
            const moveRegexPart = `(O-O(?:-O)?|[PNBRQK]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?)`;
            const combinedRegex = new RegExp(`\\b(?:${namesRegexPart ? `(${namesRegexPart})|` : ''}${moveRegexPart})\\b`, 'gi');
            
            const allMatches = [...modelOutputRef.current.matchAll(combinedRegex)];

            while (allMatches.length > (lastProcessedMatchIndexRef.current + 1)) {
                const nextIndexToProcess = lastProcessedMatchIndexRef.current + 1;
                const match = allMatches[nextIndexToProcess];
                
                if (match) {
                    let square: Square | null = null;
                    const matchedName = namesRegexPart ? match[1] : undefined;
                    const moveNotation = namesRegexPart ? match[2] : match[1];

                    if (matchedName) {
                        const piece = Object.values(pieceInstances).find(p => p && p.name.toLowerCase() === matchedName.toLowerCase());
                        if (piece) square = piece.square;
                    } else if (moveNotation) {
                        if (moveNotation.toUpperCase() === 'O-O') {
                            square = game.turn() === 'w' ? 'g1' : 'g8';
                        } else if (moveNotation.toUpperCase() === 'O-O-O') {
                            square = game.turn() === 'w' ? 'c1' : 'c8';
                        } else {
                            const squareMatch = moveNotation.match(/([a-h][1-8])/g);
                            if (squareMatch) square = squareMatch[squareMatch.length - 1] as Square;
                        }
                    }
                    
                    if (square) {
                        const matchIndexInString = match.index as number;
                        const textBeforeMatch = modelOutputRef.current.substring(0, matchIndexInString);
                        const wordCount = textBeforeMatch.trim().split(/\s+/).filter(Boolean).length;
                        const totalDelay = orbBaseDelay + (wordCount * orbWordDelay);

                        const timeoutId = window.setTimeout(() => {
                            setOrbPosition(square);
                            orbTimeoutsRef.current = orbTimeoutsRef.current.filter(id => id !== timeoutId);
                        }, totalDelay);
                        
                        orbTimeoutsRef.current.push(timeoutId);
                    }
                    lastProcessedMatchIndexRef.current = nextIndexToProcess;
                } else {
                    break;
                }
            }
        };

        client.on('inputTranscription', handleInput);
        client.on('outputTranscription', handleOutput);
        client.on('turncomplete', handleTurnComplete);
        return () => {
            client.off('inputTranscription', handleInput);
            client.off('outputTranscription', handleOutput);
            client.off('turncomplete', handleTurnComplete);
        };
    }, [client, game, pieceInstances, setConversationHistories, orbBaseDelay, orbWordDelay, analysisResult, setDebugLatestTurnContext, setDebugStrategy, executeHandoff]);

    useEffect(() => {
        const handleToolCall = async (toolCall: { functionCalls: any[] }) => {
            const currentChatPiece = chattingWithRef.current;
            if (!currentChatPiece) return;
    
            const processFunctionCall = async (fc: any): Promise<FunctionResponse | null> => {
                console.log(`[Tool Call] Name: ${fc.name}, Args:`, fc.args);
                let result: any;
    
                if (fc.name === 'move_piece') {
                    const from = currentChatPiece.square;
                    let { to } = fc.args;
                    
                    // Handle Castling (O-O, O-O-O) explicitly
                    if (typeof to === 'string') {
                        // Normalize 0s to Os just in case
                        const upperTo = to.toUpperCase().replace(/0/g, 'O');
                        if (upperTo === 'O-O') {
                             to = currentChatPiece.color === 'w' ? 'g1' : 'g8';
                        } else if (upperTo === 'O-O-O') {
                             to = currentChatPiece.color === 'w' ? 'c1' : 'c8';
                        } else if (to.length > 2) {
                            // Extract square if it's buried in text like "move to e4"
                            const match = to.match(/[a-h][1-8]/g); // FIX: Removed extra parenthesis here.
                            if (match) to = match[match.length - 1];
                        }
                    }

                    if (from === to) {
                        result = { status: 'ERROR', message: `You are already on ${from}. You cannot move to your current square.` };
                    } else {
                        try {
                            const tempGame = new Chess(game.fen());
                            const moveResult = tempGame.move({ from, to: to as Square, promotion: 'q' });
            
                            if (moveResult) {
                                setOrbPosition(to as Square);
                                result = await new Promise(resolve => {
                                    executeMove(moveResult, async (finalGame) => {
                                        const opponentMove = finalGame.history({ verbose: true }).pop();
                                        
                                        if (sendBoardImage) {
                                             await captureAndSendBoardImage();
                                        }

                                        // Get fresh piece data to confirm new location
                                        const allPiecesForUpdate = Object.values(pieceInstancesRef.current).filter((p): p is PieceInstance => p !== null);
                                        const updatedPiece = allPiecesForUpdate.find(p => p.id === currentChatPiece.id);
                                        
                                        if (updatedPiece) {
                                             const movesForPiece = finalGame.moves({ square: updatedPiece.square, verbose: true });
                                             const legalMovesForPrompt = movesForPiece.map(m => m.san);
                                             setValidMoves(movesForPiece.map(m => m.to));
                                             setValidMovesSAN(legalMovesForPrompt);
                                             const boardDescription = generateBoardDescription(updatedPiece, allPiecesForUpdate, legalMovesForPrompt, true);

                                             const message = `YOU HAVE MOVED to ${updatedPiece.square}. The opponent responded with ${opponentMove?.san || 'a move'}.
Current Board State:
${boardDescription}

React naturally to this new situation. DO NOT narrate that you just moved or that you updated your identity.`;
                                             resolve({ status: 'OK', message: message });
                                        } else {
                                             // Fallback if somehow the piece is gone (captured? shouldn't happen if we just moved it)
                                              resolve({ status: 'OK', message: `Move executed, but could not verify new position. Opponent responded with ${opponentMove?.san}.` });
                                        }
                                    });
                                });
                            } else {
                                // This block might not be reached if move() throws, but good as fallback
                                throw new Error("Move returned null"); 
                            }
                        } catch (e) {
                             // Error handling logic
                             const validMoves = new Chess(game.fen()).moves({ square: from as Square, verbose: true });
                             const validDestinations = validMoves.map(m => m.to).join(', ');
                             
                             result = { 
                                status: 'ERROR', 
                                message: `Analysis failed: The move from ${from} to ${to} is illegal or invalid. Your valid destination squares are: [${validDestinations || 'None'}]. Please try again with a valid move.` 
                            };
                        }
                    }
                } else if (fc.name === 'get_board_state') {
                    if (sendBoardImage) {
                        await captureAndSendBoardImage();
                    }
                    const allPieces = Object.values(pieceInstancesRef.current).filter((p): p is PieceInstance => p !== null);
                    const movesForPiece = game.moves({ square: currentChatPiece.square, verbose: true });
                    const legalMovesForPrompt = movesForPiece.map(m => m.san);
                    const boardDescription = generateBoardDescription(currentChatPiece, allPieces, legalMovesForPrompt);

                    result = { 
                        status: 'OK', 
                        message: 'Current board state provided.', 
                        fen: game.fen(), 
                        turn: game.turn(),
                        boardDescription: boardDescription
                    };
                } else if (fc.name === 'update_self_identity') {
                    if (sendBoardImage) {
                         await captureAndSendBoardImage();
                    }
                    const allPiecesForUpdate = Object.values(pieceInstancesRef.current).filter((p): p is PieceInstance => p !== null);
                    const currentPiece = allPiecesForUpdate.find(p => p.id === currentChatPiece.id);
                    if (currentPiece) {
                        const gameForAnalysis = new Chess(game.fen());
                        const movesForPiece = gameForAnalysis.moves({ square: currentPiece.square, verbose: true });
                        const legalMovesForPrompt = movesForPiece.map(m => m.san);
                        setValidMoves(movesForPiece.map(m => m.to));
                        setValidMovesSAN(legalMovesForPrompt);
                        
                        const allPieces = Object.values(pieceInstancesRef.current).filter((p): p is PieceInstance => p !== null);
                        const boardDescription = generateBoardDescription(currentPiece, allPieces, legalMovesForPrompt, true);

                        result = { 
                            status: 'OK', 
                            message: 'Identity updated.', 
                            newSquare: currentPiece.square,
                            fen: game.fen(),
                            boardDescription: boardDescription,
                        };
                    } else {
                        result = { status: 'ERROR', message: 'Could not find your piece data.' };
                    }
                } else if (fc.name === 'yield_control_to_piece') {
                    const { square, handoff_message } = fc.args;
                    if (typeof square === 'string' && /^[a-h][1-8]$/.test(square)) {
                        const allPiecesForYield = Object.values(pieceInstancesRef.current).filter((p): p is PieceInstance => p !== null);
                        const targetPiece = allPiecesForYield.find(p => p.square === square && p.color === currentChatPiece.color);
                        if (targetPiece) {
                            // Stop recording immediately to prevent interference during handoff.
                            setIsRecording(false);

                            // Store handoff intent. We will execute it in `handleTurnComplete` to ensure audio finishes.
                            pendingHandoffRef.current = { targetPiece, message: handoff_message };
                            
                            // If the turn is already complete (rare race condition where tool processing lagged),
                            // execute immediately.
                            if (turnCompleteReceivedRef.current) {
                                executeHandoff();
                            }
                            
                            result = { status: 'OK', message: `Control yielding logic initiated. I am finishing my speaking turn.` };
                        } else {
                            result = { status: 'ERROR', message: `Could not find a friendly piece at ${square}.` };
                        }
                    } else {
                        result = { status: 'ERROR', message: `Invalid square format: ${square}.` };
                    }
                } else if (fc.name === 'consult_strategy') {
                    if (analysisState === 'ready' && analysisResult) {
                         result = { status: 'OK', message: `Strategic Analysis (Treat as a fresh insight of your own):\n${analysisResult}` };
                    } else {
                         // Mark it so it gets pushed proactively when ready
                         setWantsProactiveStrategy(true);
                         result = { status: 'WAITING', message: 'Strategy is still being analyzed. Fill the silence naturally (e.g., "Hmm, let me see...", "Just a moment...") without mentioning that you are waiting for data.' };
                    }
                }
    
                if (result) {
                    console.log(`[Tool Response] Name: ${fc.name}, Result:`, result);
                    return { id: fc.id, name: fc.name, response: { result: JSON.stringify(result) } };
                }
                return null;
            };
    
            const responses = (await Promise.all(toolCall.functionCalls.map(processFunctionCall)))
                .filter((r): r is FunctionResponse => r !== null);
    
            if (responses.length > 0) {
                const toolResponsePayload = { functionResponses: responses };
                setDebugLatestTurnContext(JSON.stringify(toolResponsePayload, null, 2));
                client.sendToolResponse(toolResponsePayload);
            }
        };
        client.on('toolcall', handleToolCall);
        return () => client.off('toolcall', handleToolCall);
    }, [client, game, executeMove, startChat, audioStreamer, setDebugLatestTurnContext, captureAndSendBoardImage, analysisState, analysisResult, sendBoardImage, executeHandoff]);


    const handleSquareClick = (square: Square) => {
        const pieceInstance = pieceInstances[square];
        const pieceOnSelectedSquare = selectedSquare ? game.get(selectedSquare) : null;
    
        if (selectedSquare && pieceOnSelectedSquare?.color === 'w' && game.turn() === 'w' && validMoves.includes(square)) {
            const moveResult = new Chess(game.fen()).move({ from: selectedSquare, to: square, promotion: 'q' });
            if (moveResult) {
              setOrbPosition(square);
              executeMove(moveResult);
              clearChat();
            }
            return;
        }
    
        if (pieceInstance) {
            if (chattingWith?.id === pieceInstance.id) {
                setIsRecording(isRec => !isRec);
            } 
            else {
                startChat(pieceInstance);
            }
            return;
        }
        
        clearChat();
    };

    useEffect(() => {
        if (selectedSquare) {
            const piece = game.get(selectedSquare);
            if (piece) {
                const newMoves = game.moves({ square: selectedSquare, verbose: true });
                setValidMoves(newMoves.map(m => m.to));
                setValidMovesSAN(newMoves.map(m => m.san));
            } else {
                setSelectedSquare(null);
                setValidMoves([]);
                setValidMovesSAN([]);
            }
        }
    }, [game, selectedSquare]);

    useEffect(() => {
        const history = game.history({ verbose: true });
        if (history.length > previousHistoryLength.current) {
            const lastMove = history[history.length - 1];
            if (lastMove.color === 'b') {
                setOrbPosition(lastMove.to);
            }
        }
        previousHistoryLength.current = history.length;
    }, [game]);

    useEffect(() => {
        if(chattingWith) {
            const currentInstance = Object.values(pieceInstances).find(p => p?.id === chattingWith.id);
            if (currentInstance && currentInstance.square !== chattingWith.square) {
                setChattingWith(currentInstance);
                setSelectedSquare(currentInstance.square);
                setOrbPosition(currentInstance.square);
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pieceInstances, chattingWith]);

    return {
        selectedSquare, validMoves, validMovesSAN, chattingWith, isRecording, error, talkingVolume, userVolume, orbPosition, hoveredSquare,
        handleSquareClick, setChattingWith, setHoveredSquare, retryStrategyAnalysis
    };
}
