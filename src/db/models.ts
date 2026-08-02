import {Model} from '@nozbe/watermelondb';
import {date, field, text} from '@nozbe/watermelondb/decorators';

export class User extends Model {
  static table = 'users';

  @text('nickname') nickname!: string;
  @text('avatar_char') avatarChar!: string;
  @text('du_number') duNumber!: string;
  @field('hometown_id') hometownId?: string;
  @field('current_city_id') currentCityId?: string;
  @date('current_city_arrival') currentCityArrival?: Date;
  @date('created_at') createdAt!: Date;
  @text('daily_reminder_time') dailyReminderTime!: string;
  @field('letter_reminder_on') letterReminderOn!: boolean;
  @text('theme') theme!: string;
  @field('passcode_on') passcodeOn!: boolean;
  @text('dark_mode') darkMode!: string;
}

export class Place extends Model {
  static table = 'places';

  @text('name') name!: string;
  @text('ch_char') chChar!: string;
  @text('pinyin') pinyin!: string;
  @text('color_hex') colorHex!: string;
  @text('type') type!: string;
  @date('first_visit') firstVisit?: Date;
  @date('last_visit') lastVisit?: Date;
  @field('visit_count') visitCount!: number;
  @field('sort_order') sortOrder!: number;
}

export class Memory extends Model {
  static table = 'memories';

  @text('type') type!: string;
  @text('content') content!: string;
  @field('image_path') imagePath?: string;
  @field('audio_path') audioPath?: string;
  @field('audio_duration') audioDuration?: number;
  @field('ink_image_path') inkImagePath?: string;
  @field('place_id') placeId?: string;
  @field('place_detail') placeDetail?: string;
  @field('weather_tag') weatherTag?: string;
  @text('body_tags') bodyTags!: string;
  @text('heart_tags') heartTags!: string;
  @text('custom_tags') customTags!: string;
  @field('photo_tone') photoTone?: string;
  @field('mood') mood?: string;
  @date('written_at') writtenAt!: Date;
  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
  @field('is_future_letter') isFutureLetter!: boolean;
  @field('letter_id') letterId?: string;
  @field('deleted') deleted!: boolean;
}

export class Letter extends Model {
  static table = 'letters';

  @text('memory_id') memoryId!: string;
  @date('sent_at') sentAt!: Date;
  @date('arrive_date') arriveDate!: Date;
  @text('arrive_type') arriveType!: string;
  @text('to_type') toType!: string;
  @text('to_name') toName!: string;
  @text('status') status!: string;
  @date('opened_at') openedAt?: Date;
  @field('reply_memory_id') replyMemoryId?: string;
}

export class Setting extends Model {
  static table = 'settings';

  @text('user_id') userId!: string;
  @text('theme_mode') themeMode!: string;
  @field('daily_reminder_on') dailyReminderOn!: boolean;
  @text('daily_reminder_time') dailyReminderTime!: string;
  @field('letter_reminder_on') letterReminderOn!: boolean;
  @field('biometric_lock_on') biometricLockOn!: boolean;
  @text('default_city') defaultCity!: string;
  @field('onboarding_completed') onboardingCompleted!: boolean;
  @date('privacy_accepted_at') privacyAcceptedAt?: Date;
  @date('updated_at') updatedAt!: Date;
}

export class Tag extends Model {
  static table = 'tags';

  @text('category') category!: string;
  @text('text') text!: string;
  @text('color_hex') colorHex!: string;
  @field('season_hint') seasonHint?: string;
  @field('sort_order') sortOrder!: number;
}

export const modelClasses = [User, Memory, Letter, Place, Setting, Tag];
