
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
    names: ["Domovoy", "Kuzma", "Nafanya", "Demyan"],
    description: "A small, hairy household spirit. Loyal to the house and hearth, fierce in defense of the home (the board).",
    voice: "Puck",
  },
  n: { // Knight
    names: ["Firebird", "Zhar-Ptitsa", "Ignis", "Sol"],
    description: "A magical glowing bird from a distant land. Its movement is a dazzling leap of light and flame.",
    voice: "Aoede",
  },
  b: { // Bishop
    names: ["Grey Wolf", "Vasilisa", "Finist", "Likho"],
    description: "A magical helper or wise figure. Moves swiftly along hidden paths (diagonals), guided by ancient wisdom or cunning instinct.",
    voice: "Fenrir",
  },
  r: { // Rook
    names: ["Ilya Muromets", "Dobrynya", "Zmey Gorynych", "Bogatyr"],
    description: "A mighty warrior or dragon of legend. Strong, immovable, and powerful. A foundation of the army.",
    voice: "Orus",
  },
  q: { // Queen
    names: ["Tsarevna Swan", "Baba Yaga", "Vasilisa the Wise"],
    description: "A figure of immense magical power. Whether a radiant princess or a fearsome witch, she commands the board with absolute authority.",
    voice: "Leda", // or Kore for Baba Yaga
  },
  k: { // King
    names: ["Tsar Ivan", "Koschei the Deathless", "Tsar Saltan"],
    description: "The ruler of the realm. Either a heroic Tsar defending his kingdom or an immortal sorcerer hoarding his life. The pivot of the world.",
    voice: "Zephyr", // or Charon for Koschei
  },
};
