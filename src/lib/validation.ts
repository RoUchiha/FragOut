import {z} from 'zod';
import {moodOptions,vibeOptions} from './intent.ts';
export const intentFields={mood:z.enum(moodOptions.map(([id])=>id)).default('ANY'),vibe:z.enum(vibeOptions.map(([id])=>id)).default('ANY')};
const text=(max=120)=>z.string().trim().max(max);
export const bottleSchema=z.object({
  brand:text().min(1),name:text().min(1),concentration:z.enum(['EDT','EDP','PARFUM','ELIXIR','OIL','OTHER','UNKNOWN']),ownership:z.enum(['OWNED','WISHLIST','REMOVED']),
  family:text(60),notes:z.array(text(50).min(1)).max(30),strength:z.number().int().min(1).max(3),climate:z.enum(['FRESH','BALANCED','WARM','UNKNOWN']),
  profileKnown:z.boolean(),provenance:z.enum(['personal','unknown']),color:z.string().regex(/^#[0-9a-fA-F]{6}$/),shape:z.enum(['square','round','tall']),
  sizeMl:z.number().min(1).max(2000),fillPct:z.number().min(0).max(100),rating:z.number().int().min(0).max(5),favorite:z.boolean(),memo:text(2000)
}).strict();
export const contextSchema=z.object({city:text(80).min(1),tempC:z.number().min(-60).max(60),humidity:z.number().min(0).max(100),setting:z.enum(['INDOOR','OUTDOOR','MIXED']),indoorTempC:z.number().min(-10).max(50),occasion:text(40),policy:z.enum(['FREE','LOW_SCENT','NO_FRAGRANCE']),eventAtLocal:text(30),timezone:text(80).refine(v=>{try{new Intl.DateTimeFormat('en',{timeZone:v}).format();return true;}catch{return false;}},'Use a valid IANA time zone.'),latitude:z.number().min(-90).max(90),source:z.literal('manual')}).strict();
export const preferencesSchema=z.object({likedNotes:z.array(text(50)).max(30),dislikedNotes:z.array(text(50)).max(30),excludedIds:z.array(text(100)).max(200),maxStrength:z.number().int().min(1).max(3),sensitivity:z.boolean(),units:z.enum(['C','F']),archiveOutfits:z.boolean().optional()}).strict();
export const shortcutSchema=z.object({id:text(100).min(1),title:text(30).min(1),icon:z.enum(['dumbbell','heart','briefcase','wine','shopping','coffee','sun','sparkles']),occasion:z.enum(['GENERAL','GYM','DATE','WORK','PARTY','ERRANDS','CUSTOM']),setting:z.enum(['INDOOR','OUTDOOR','MIXED']),durationHours:z.number().min(0.5).max(24),maxStrength:z.number().int().min(1).max(3),hidden:z.boolean()}).strict();
export const settingsSchema=z.object({preferences:preferencesSchema.optional(),context:contextSchema.optional(),shortcuts:z.array(shortcutSchema).max(20).refine(items=>new Set(items.map(s=>s.id)).size===items.length,'Shortcut IDs must be unique.').optional()}).strict();
