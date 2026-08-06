import { Model } from '@nozbe/watermelondb';
import { date, field, text } from '@nozbe/watermelondb/decorators';

export class User extends Model {
  static table = 'users';

  @text('nickname') nickname!: string;
  @text('avatar_char') avatarChar!: string;
  @field('avatar_path') avatarPath?: string;
  @text('du_number') duNumber!: string;
  @field('hometown_id') hometownId?: string;
  @field('current_city_id') currentCityId?: string;
  @date('current_city_arrival') currentCityArrival?: Date;
  @date('birthday') birthday?: Date;
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
  @field('region') region?: string;
  @field('country_code') countryCode?: string;
}

export class Memory extends Model {
  static table = 'memories';

  @text('type') type!: string;
  @text('content') content!: string;
  @text('status') status!: string;
  @field('image_path') imagePath?: string;
  @field('audio_path') audioPath?: string;
  @field('audio_duration') audioDuration?: number;
  @field('ink_image_path') inkImagePath?: string;
  @field('place_id') placeId?: string;
  @field('place_detail') placeDetail?: string;
  @field('place_city') placeCity?: string;
  @field('place_region') placeRegion?: string;
  @field('place_country_code') placeCountryCode?: string;
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
  @date('future_arrive_at') futureArriveAt?: Date;
  @field('future_arrive_type') futureArriveType?: string;
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
  @text('art_skin') artSkin!: string;
  @field('daily_reminder_on') dailyReminderOn!: boolean;
  @text('daily_reminder_time') dailyReminderTime!: string;
  @field('letter_reminder_on') letterReminderOn!: boolean;
  @text('letter_reminder_time') letterReminderTime!: string;
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

export class Wish extends Model {
  static table = 'wishes';

  @text('user_id') userId!: string;
  @text('title') title!: string;
  @field('note') note?: string;
  @field('color') color?: string;
  @field('category') category?: string;
  @date('target_at') targetAt?: Date;
  @text('status') status!: string;
  @field('pinned') pinned!: boolean;
  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
  @date('deleted_at') deletedAt?: Date;
}

export class WishTape extends Model {
  static table = 'wish_tapes';

  @text('wish_id') wishId!: string;
  @text('text') text!: string;
  @text('style') style!: string;
  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
  @date('deleted_at') deletedAt?: Date;
}

export class Quest extends Model {
  static table = 'quests';

  @text('user_id') userId!: string;
  @text('title') title!: string;
  @field('description') description?: string;
  @text('theme_color') themeColor!: string;
  @text('cover_mode') coverMode!: string;
  @field('cover_image_asset_id') coverImageAssetId?: string;
  @field('is_template') isTemplate!: boolean;
  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
  @date('deleted_at') deletedAt?: Date;
}

export class QuestNode extends Model {
  static table = 'quest_nodes';

  @text('quest_id') questId!: string;
  @text('title') title!: string;
  @text('icon') icon!: string;
  @field('x') x!: number;
  @field('y') y!: number;
  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
  @date('deleted_at') deletedAt?: Date;
}

export class QuestEdge extends Model {
  static table = 'quest_edges';

  @text('quest_id') questId!: string;
  @text('from_node_id') fromNodeId!: string;
  @text('to_node_id') toNodeId!: string;
  @text('style') style!: string;
  @date('created_at') createdAt!: Date;
  @date('deleted_at') deletedAt?: Date;
}

export class QuestSticky extends Model {
  static table = 'quest_stickies';

  @text('quest_id') questId!: string;
  @text('node_id') nodeId!: string;
  @text('text') text!: string;
  @text('color') color!: string;
  @field('memory_id') memoryId?: string;
  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
  @date('deleted_at') deletedAt?: Date;
}

export class CollagePage extends Model {
  static table = 'collage_pages';

  @text('user_id') userId!: string;
  @text('photo_paths') photoPaths!: string;
  @text('palette') palette!: string;
  @field('layout_seed') layoutSeed!: number;
  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
  @date('deleted_at') deletedAt?: Date;
}

export class Book extends Model {
  static table = 'books';

  @text('user_id') userId!: string;
  @text('title') title!: string;
  @text('subtitle') subtitle!: string;
  @text('year') year!: string;
  @text('categories') categories!: string;
  @text('cover_template') coverTemplate!: string;
  @text('cover_bg') coverBg!: string;
  @text('cover_accent') coverAccent!: string;
  @text('cover_text') coverText!: string;
  @field('cover_image_path') coverImagePath?: string;
  @field('spine_width') spineWidth!: number;
  @text('source') source!: string;
  @field('current_page') currentPage!: number;
  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
  @date('deleted_at') deletedAt?: Date;
}

export class BookPage extends Model {
  static table = 'book_pages';

  @text('book_id') bookId!: string;
  @field('page_index') pageIndex!: number;
  @text('type') type!: string;
  @field('date_label') dateLabel?: string;
  @field('text_content') textContent?: string;
  @field('quote') quote?: string;
  @field('author') author?: string;
  @field('decoration') decoration?: string;
  @field('source_type') sourceType?: string;
  @field('source_id') sourceId?: string;
  @date('created_at') createdAt!: Date;
}

export class Scrap extends Model {
  static table = 'scraps';

  @text('user_id') userId!: string;
  @text('text_content') textContent!: string;
  @text('source_label') sourceLabel!: string;
  @text('source_type') sourceType!: string;
  @field('source_id') sourceId?: string;
  @field('source_book_id') sourceBookId?: string;
  @text('color') color!: string;
  @text('card_type') cardType!: string;
  @field('x') x!: number;
  @field('y') y!: number;
  @field('rotation') rotation!: number;
  @field('tape_color') tapeColor?: string;
  @field('has_letter_line') hasLetterLine!: boolean;
  @field('archived') archived!: boolean;
  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
  @date('deleted_at') deletedAt?: Date;
}

export const modelClasses = [
  User,
  Memory,
  Letter,
  Place,
  Setting,
  Tag,
  Wish,
  WishTape,
  Quest,
  QuestNode,
  QuestEdge,
  QuestSticky,
  CollagePage,
  Book,
  BookPage,
  Scrap,
];
