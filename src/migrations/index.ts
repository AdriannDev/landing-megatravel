import * as migration_20261028_220221_initial from './20261028_220221_initial';
import * as migration_20261028_220255_programs_and_banner_placements from './20261028_220255_programs_and_banner_placements';
import * as migration_20261028_230629_popup_announcements from './20261028_230629_popup_announcements';
import * as migration_20261029_175432_departure_seat_references from './20261029_175432_departure_seat_references';

export const migrations = [
  {
    up: migration_20261028_220221_initial.up,
    down: migration_20261028_220221_initial.down,
    name: '20261028_220221_initial',
  },
  {
    up: migration_20261028_220255_programs_and_banner_placements.up,
    down: migration_20261028_220255_programs_and_banner_placements.down,
    name: '20261028_220255_programs_and_banner_placements',
  },
  {
    up: migration_20261028_230629_popup_announcements.up,
    down: migration_20261028_230629_popup_announcements.down,
    name: '20261028_230629_popup_announcements',
  },
  {
    up: migration_20261029_175432_departure_seat_references.up,
    down: migration_20261029_175432_departure_seat_references.down,
    name: '20261029_175432_departure_seat_references'
  },
];
