import * as migration_20261028_220221_initial from './20261028_220221_initial';
import * as migration_20261028_220255_programs_and_banner_placements from './20261028_220255_programs_and_banner_placements';
import * as migration_20261028_230629_popup_announcements from './20261028_230629_popup_announcements';
import * as migration_20261029_175432_departure_seat_references from './20261029_175432_departure_seat_references';
import * as migration_20261102_120000_popup_formats from './20261102_120000_popup_formats';
import * as migration_20261102_130000_departure_deletion from './20261102_130000_departure_deletion';
import * as migration_20261102_173707_program_shared_seats from './20261102_173707_program_shared_seats';
import * as migration_20261104_171419_r2_media_storage from './20261104_171419_r2_media_storage';
import * as migration_20261109_014741_new_badge from './20261109_014741_new_badge';
import * as migration_20261109_060013_blog_post_sync from './20261109_060013_blog_post_sync';
import * as migration_20261109_201333_date_overrides from './20261109_201333_date_overrides';

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
    name: '20261029_175432_departure_seat_references',
  },
  {
    up: migration_20261102_120000_popup_formats.up,
    down: migration_20261102_120000_popup_formats.down,
    name: '20261102_120000_popup_formats',
  },
  {
    up: migration_20261102_130000_departure_deletion.up,
    down: migration_20261102_130000_departure_deletion.down,
    name: '20261102_130000_departure_deletion',
  },
  {
    up: migration_20261102_173707_program_shared_seats.up,
    down: migration_20261102_173707_program_shared_seats.down,
    name: '20261102_173707_program_shared_seats',
  },
  {
    up: migration_20261104_171419_r2_media_storage.up,
    down: migration_20261104_171419_r2_media_storage.down,
    name: '20261104_171419_r2_media_storage',
  },
  {
    up: migration_20261109_014741_new_badge.up,
    down: migration_20261109_014741_new_badge.down,
    name: '20261109_014741_new_badge',
  },
  {
    up: migration_20261109_060013_blog_post_sync.up,
    down: migration_20261109_060013_blog_post_sync.down,
    name: '20261109_060013_blog_post_sync',
  },
  {
    up: migration_20261109_201333_date_overrides.up,
    down: migration_20261109_201333_date_overrides.down,
    name: '20261109_201333_date_overrides'
  },
];
