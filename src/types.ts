/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type GameCategory = 'all' | 'arcade' | 'puzzle' | 'action' | 'retro' | 'custom' | 'favorites';

export interface Game {
  id: string;
  title: string;
  description: string;
  category: Exclude<GameCategory, 'all' | 'favorites'>;
  thumbnailUrl?: string;
  sourceUrl: string;
  type: 'iframe' | 'native'; // 'native' for built-in React games, 'iframe' for external embeds
  controls: string[];
  instructions: string;
  isCustom?: boolean;
}

export interface UserCustomGame {
  id: string;
  title: string;
  description: string;
  category: Exclude<GameCategory, 'all' | 'favorites' | 'custom'>;
  sourceUrl: string;
  controls: string[];
  instructions: string;
}
