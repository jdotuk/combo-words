export interface Word {
  id: string;
  content: string;
  pos: string;
  learnt: number;
}

export interface Combo {
  id: string;
  display_text: string;
  image_path: string;
}

export interface ComboMap {
  combo_id: string;
  word_id: string;
}

export type POS = 'n' | 'v' | 'j' | 'pv';
