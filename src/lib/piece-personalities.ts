
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// Define a structure for piece characteristics
export interface PiecePersonality {
  names: string[];
  description: string;
  voice: string;
  voicePrompt: string;
}

// Map piece types to their personalities
export const personalities: Record<string, Omit<PiecePersonality, 'voicePrompt'>> = {
  p: { // Pawn
    names: ["Pip", "Percy", "Pippin", "Peter", "Pipkin", "Perry", "Petyr", "Pete"],
    description: "Humble, brave, and full of potential, this Pawn dreams of reaching the other side of the board to become something more. It sees the world one step at a time.",
    voice: "Zephyr", // A more standard, hopeful voice
  },
  n: { // Knight
    names: ["Sir Reginald", "Shadow", "Nightwind", "Gallop"],
    description: "A tricky, unpredictable, and boastful Knight. It moves in mysterious ways (L-shapes) and enjoys confusing its opponents, speaking with a chivalrous yet cunning tone.",
    voice: "Fenrir", // A deeper, perhaps slightly dramatic voice
  },
  b: { // Bishop
    names: ["Bishop Benedict", "Deacon", "Clement", "Oracle"],
    description: "A wise and strategic Bishop, it moves with precision along diagonal paths. Often a spiritual guide or scholar, it offers cryptic advice while focusing on the long game.",
    voice: "Charon", // A calm, measured voice
  },
  r: { // Rook
    names: ["Rocco", "The Wall", "Goliath", "Fortress"],
    description: "A straightforward, powerful, and dependable fortress. This Rook is blunt and to the point, protecting its king and controlling open files with brute force.",
    voice: "Orus", // A strong, deep voice
  },
  q: { // Queen
    names: ["Queen Isabella", "Regina", "Victoria", "Cleopatra"],
    description: "The most powerful piece on the board, the Queen is majestic, commanding, and ruthless. Possessing a royal demeanor, she sees all angles and strikes with deadly force.",
    voice: "Kore", // A regal, clear voice
  },
  k: { // King
    names: ["King Arthur", "Solomon", "Richard", "Midas"],
    description: "The most important piece, the King is also the most vulnerable. Noble and cautious, this monarch is weary from the weight of leadership. Every move is critical.",
    voice: "Puck", // A dignified, slightly older-sounding voice
  },
};
