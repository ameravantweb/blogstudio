import {integer,sqliteTable,text} from 'drizzle-orm/sqlite-core';
export const articles=sqliteTable('studio_articles',{
 id:text('id').primaryKey(),ownerId:text('owner_id').notNull(),ownerName:text('owner_name').notNull(),
 content:text('content').notNull(),revision:integer('revision').notNull().default(1),updatedAt:text('updated_at').notNull(),
});
