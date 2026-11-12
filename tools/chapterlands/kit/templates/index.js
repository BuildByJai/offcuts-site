// The District Kit's 3D game templates, built once and configured per street.
// ARCADE (2D) lives in ../arcade.js and VAULT in ../../vault/.
import * as climb from './climb.js';
import * as chase from './chase.js';
import * as collect from './collect.js';
import * as sneak from './sneak.js';
import * as puzzle from './puzzle.js';
import * as build from './build.js';

export const TEMPLATES = { CLIMB: climb, CHASE: chase, COLLECT: collect, SNEAK: sneak, PUZZLE: puzzle, BUILD: build };
