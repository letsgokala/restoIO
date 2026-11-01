import dotenv from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../.env') });
import argon2 from 'argon2';
import { createHash } from 'node:crypto';
import { PrismaClient, UserRole } from './generated/prisma/index.js';
import { encryptQrToken } from './modules/management/services/qr-crypto.js';
const prisma = new PrismaClient();
async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('The development seed is disabled in production');
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@demo.local';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe_OnlyForLocalDev_123!';
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  const restaurant = await prisma.restaurant.upsert({ where: { slug: 'blue-nile-cafe' }, update: { description: 'Ethiopian classics and generous hospitality in the heart of Bole.' }, create: { name: 'Blue Nile Café', slug: 'blue-nile-cafe', description: 'Ethiopian classics and generous hospitality in the heart of Bole.' } });
  const branch = await prisma.branch.upsert({ where: { restaurantId_slug: { restaurantId: restaurant.id, slug: 'bole' } }, update: {}, create: { restaurantId: restaurant.id, name: 'Bole Branch', slug: 'bole', address: 'Bole, Addis Ababa' } });
  const admin = await prisma.user.upsert({ where: { email }, update: { displayName: 'Development Administrator', passwordHash, isPlatformAdmin: true, isActive: true }, create: { email, displayName: 'Development Administrator', passwordHash, isPlatformAdmin: true } });
  const owner = await prisma.user.upsert({ where: { email: 'owner@blue-nile.demo.local' }, update: { displayName: 'Demo Restaurant Owner', passwordHash, isActive: true }, create: { email: 'owner@blue-nile.demo.local', displayName: 'Demo Restaurant Owner', passwordHash, isActive: true } });
  const waiter = await prisma.user.upsert({ where: { email: 'waiter@blue-nile.demo.local' }, update: { displayName: 'Demo Floor Waiter', passwordHash, isActive: true }, create: { email: 'waiter@blue-nile.demo.local', displayName: 'Demo Floor Waiter', passwordHash, isActive: true } });
  const kitchen = await prisma.user.upsert({ where: { email: 'kitchen@blue-nile.demo.local' }, update: { displayName: 'Demo Kitchen Staff', passwordHash, isActive: true }, create: { email: 'kitchen@blue-nile.demo.local', displayName: 'Demo Kitchen Staff', passwordHash, isActive: true } });
  const cashier = await prisma.user.upsert({ where: { email: 'cashier@blue-nile.demo.local' }, update: { displayName: 'Demo Cashier', passwordHash, isActive: true }, create: { email: 'cashier@blue-nile.demo.local', displayName: 'Demo Cashier', passwordHash, isActive: true } });
  await prisma.membership.updateMany({ where: { userId: owner.id, restaurantId: restaurant.id, role: UserRole.RESTAURANT_OWNER, branchId: { not: null } }, data: { isActive: false } });
  const ownerMembership = await prisma.membership.findFirst({ where: { userId: owner.id, restaurantId: restaurant.id, role: UserRole.RESTAURANT_OWNER, branchId: null } });
  if (ownerMembership) await prisma.membership.update({ where: { id: ownerMembership.id }, data: { isActive: true } });
  else await prisma.membership.create({ data: { userId: owner.id, restaurantId: restaurant.id, role: UserRole.RESTAURANT_OWNER } });
  const waiterMembership = await prisma.membership.findFirst({ where: { userId: waiter.id, restaurantId: restaurant.id, role: UserRole.WAITER, branchId: branch.id } });
  if (waiterMembership) await prisma.membership.update({ where: { id: waiterMembership.id }, data: { isActive: true } });
  else await prisma.membership.create({ data: { userId: waiter.id, restaurantId: restaurant.id, branchId: branch.id, role: UserRole.WAITER } });
  const kitchenMembership = await prisma.membership.findFirst({ where: { userId: kitchen.id, restaurantId: restaurant.id, role: UserRole.KITCHEN, branchId: branch.id } });
  if (kitchenMembership) await prisma.membership.update({ where: { id: kitchenMembership.id }, data: { isActive: true } });
  else await prisma.membership.create({ data: { userId: kitchen.id, restaurantId: restaurant.id, branchId: branch.id, role: UserRole.KITCHEN } });
  const cashierMembership = await prisma.membership.findFirst({ where: { userId: cashier.id, restaurantId: restaurant.id, role: UserRole.CASHIER, branchId: branch.id } });
  if (cashierMembership) await prisma.membership.update({ where: { id: cashierMembership.id }, data: { isActive: true } });
  else await prisma.membership.create({ data: { userId: cashier.id, restaurantId: restaurant.id, branchId: branch.id, role: UserRole.CASHIER } });
  const tableLabels = ['01', '02', '03', '04', '08'];
  for (const label of tableLabels) {
    const table = await prisma.diningTable.upsert({ where: { branchId_label: { branchId: branch.id, label } }, update: {}, create: { restaurantId: restaurant.id, branchId: branch.id, label } });
    if (label === '01') {
      const rawToken = 'demo-table-01-qr-token-for-local-development-only';
      const tokenHash = createHash('sha256').update(rawToken).digest('hex');
      await prisma.qRToken.upsert({ where: { tokenHash }, update: { isActive: true, revokedAt: null, tokenCiphertext: encryptQrToken(rawToken) }, create: { restaurantId: restaurant.id, branchId: branch.id, tableId: table.id, tokenHash, tokenCiphertext: encryptQrToken(rawToken) } });
    }
  }
  let category = await prisma.menuCategory.findFirst({ where: { restaurantId: restaurant.id, name: 'From the kitchen' } });
  if (!category) category = await prisma.menuCategory.create({ data: { restaurantId: restaurant.id, name: 'From the kitchen', sortOrder: 1 } });
  const categoryNames: Record<string, string> = {
    am: 'ከኩሽናችን', ar: 'من مطبخنا', zh: '来自厨房', tr: 'Mutfağımızdan', es: 'De nuestra cocina', de: 'Aus unserer Küche',
  };
  for (const [locale, name] of Object.entries(categoryNames)) {
    await prisma.menuCategoryTranslation.upsert({ where: { categoryId_locale: { categoryId: category.id, locale } }, update: { name }, create: { categoryId: category.id, locale, name } });
  }
  const dishes = [
    { name: 'Doro wat', description: 'Slow-cooked chicken in a warmly spiced berbere sauce, served with injera.', ingredients: 'Chicken, onion, berbere, garlic, ginger, egg, niter kibbeh, injera', allergens: 'Egg, gluten (injera)', portionSize: 'One serving', price: '480.00', dietaryLabels: ['Contains meat'], spiceLevel: 2 },
    { name: 'Shiro tegamino', description: 'Silky chickpea stew with garlic and house berbere, served with injera.', ingredients: 'Chickpea, onion, garlic, berbere, oil, injera', allergens: 'Legumes, gluten (injera)', portionSize: 'One serving', price: '260.00', dietaryLabels: ['Vegan'], spiceLevel: 2 },
    { name: 'Misir wat', description: 'Red lentils simmered until tender with onion and aromatic spices.', ingredients: 'Red lentils, onion, garlic, berbere, oil', allergens: 'Legumes', portionSize: 'One serving', price: '240.00', dietaryLabels: ['Vegan', 'Gluten free'], spiceLevel: 2 },
  ];
  const dishTranslations: Record<string, Record<string, { name: string; description: string; ingredients: string; allergens: string; portionSize: string }>> = {
    'Doro wat': {
      am: { name: 'ዶሮ ወጥ', description: 'በበርበሬ ቅመም ቀስ ብሎ የበሰለ የዶሮ ወጥ፤ ከእንጀራ ጋር ይቀርባል።', ingredients: 'ዶሮ፣ ሽንኩርት፣ በርበሬ፣ ነጭ ሽንኩርት፣ ዝንጅብል፣ እንቁላል፣ ንጥር ቅቤ፣ እንጀራ', allergens: 'እንቁላል፣ ግሉተን (እንጀራ)', portionSize: 'አንድ ሰው የሚመጥን' },
      ar: { name: 'دورو وات', description: 'يخنة دجاج مطهوة على نار هادئة مع بهارات البربريه، وتُقدَّم مع الإينجيرا.', ingredients: 'دجاج، بصل، بربريه، ثوم، زنجبيل، بيض، نيتِر كِبّه، إينجيرا', allergens: 'بيض، غلوتين (الإينجيرا)', portionSize: 'حصة واحدة' },
      zh: { name: '埃塞俄比亚辣炖鸡', description: '鸡肉与埃塞俄比亚伯伯雷香料慢炖，搭配英吉拉酸面饼。', ingredients: '鸡肉、洋葱、伯伯雷香料、大蒜、生姜、鸡蛋、尼特尔基贝香料黄油、英吉拉酸面饼', allergens: '鸡蛋、麸质（英吉拉酸面饼）', portionSize: '一人份' },
      tr: { name: 'Doro wat', description: 'Berbere baharatlarıyla ağır ateşte pişirilen tavuk yahnisi, injera ile servis edilir.', ingredients: 'Tavuk, soğan, berbere, sarımsak, zencefil, yumurta, niter kibbeh, injera', allergens: 'Yumurta, gluten (injera)', portionSize: 'Bir kişilik' },
      es: { name: 'Doro wat', description: 'Pollo guisado a fuego lento con especias berbere, servido con injera.', ingredients: 'Pollo, cebolla, berbere, ajo, jengibre, huevo, niter kibbeh e injera', allergens: 'Huevo y gluten (injera)', portionSize: 'Una ración' },
      de: { name: 'Doro wat', description: 'Langsam geschmortes Hähnchen mit Berbere-Gewürzen, serviert mit Injera.', ingredients: 'Hähnchen, Zwiebeln, Berbere, Knoblauch, Ingwer, Ei, Niter Kibbeh und Injera', allergens: 'Ei, Gluten (Injera)', portionSize: 'Eine Portion' },
    },
    'Shiro tegamino': {
      am: { name: 'ሽሮ ጠጋሚኖ', description: 'ከሽሮ ዱቄት፣ ከነጭ ሽንኩርትና ከበርበሬ ቅመም የተዘጋጀ ለስላሳ ወጥ፤ ከእንጀራ ጋር ይቀርባል።', ingredients: 'ሽሮ ዱቄት (ሽምብራ)፣ ሽንኩርት፣ ነጭ ሽንኩርት፣ በርበሬ፣ ዘይት፣ እንጀራ', allergens: 'ጥራጥሬ (ሽምብራ)፣ ግሉተን (እንጀራ)', portionSize: 'አንድ ሰው የሚመጥን' },
      ar: { name: 'شيرو', description: 'يخنة إثيوبية ناعمة من الحمص مع الثوم وبهارات البربريه، تُقدَّم مع الإينجيرا.', ingredients: 'مسحوق الحمص، بصل، ثوم، بربريه، زيت، إينجيرا', allergens: 'بقوليات (حمص)، غلوتين (الإينجيرا)', portionSize: 'حصة واحدة' },
      zh: { name: '埃塞俄比亚鹰嘴豆炖菜', description: '鹰嘴豆粉加入大蒜和伯伯雷香料炖煮，搭配英吉拉酸面饼。', ingredients: '鹰嘴豆粉、洋葱、大蒜、伯伯雷香料、食用油、英吉拉酸面饼', allergens: '豆类（鹰嘴豆）、麸质（英吉拉酸面饼）', portionSize: '一人份' },
      tr: { name: 'Shiro', description: 'Nohut unu, sarımsak ve berbere baharatlarıyla hazırlanan yumuşak kıvamlı yahni; injera ile servis edilir.', ingredients: 'Nohut unu, soğan, sarımsak, berbere, yağ, injera', allergens: 'Baklagiller (nohut), gluten (injera)', portionSize: 'Bir kişilik' },
      es: { name: 'Shiro', description: 'Guiso suave de garbanzos con ajo y especias berbere, servido con injera.', ingredients: 'Harina de garbanzo, cebolla, ajo, berbere, aceite e injera', allergens: 'Legumbres (garbanzo) y gluten (injera)', portionSize: 'Una ración' },
      de: { name: 'Shiro', description: 'Sämiger Kichererbseneintopf mit Knoblauch und Berbere-Gewürzen, serviert mit Injera.', ingredients: 'Kichererbsenmehl, Zwiebeln, Knoblauch, Berbere, Öl und Injera', allergens: 'Hülsenfrüchte (Kichererbse), Gluten (Injera)', portionSize: 'Eine Portion' },
    },
    'Misir wat': {
      am: { name: 'ምስር ወጥ', description: 'ቀይ ምስር ከሽንኩርት፣ ከነጭ ሽንኩርትና ከቅመማ ቅመም ጋር እስኪለሰልስ ድረስ የበሰለ።', ingredients: 'ቀይ ምስር፣ ሽንኩርት፣ ነጭ ሽንኩርት፣ በርበሬ፣ ዘይት', allergens: 'ጥራጥሬ (ምስር)', portionSize: 'አንድ ሰው የሚመጥን' },
      ar: { name: 'ميسير وات', description: 'عدس أحمر مطهو حتى يطرى مع البصل والثوم ومزيج من التوابل الإثيوبية.', ingredients: 'عدس أحمر، بصل، ثوم، بربريه، زيت', allergens: 'بقوليات (عدس)', portionSize: 'حصة واحدة' },
      zh: { name: '埃塞俄比亚红扁豆炖菜', description: '红扁豆与洋葱、大蒜和香料一起炖至软嫩。', ingredients: '红扁豆、洋葱、大蒜、伯伯雷香料、食用油', allergens: '豆类（扁豆）', portionSize: '一人份' },
      tr: { name: 'Misir wat', description: 'Kırmızı mercimek; soğan, sarımsak ve aromatik baharatlarla yumuşayana kadar pişirilir.', ingredients: 'Kırmızı mercimek, soğan, sarımsak, berbere, yağ', allergens: 'Baklagiller (mercimek)', portionSize: 'Bir kişilik' },
      es: { name: 'Misir wat', description: 'Lentejas rojas guisadas hasta quedar tiernas con cebolla, ajo y especias aromáticas.', ingredients: 'Lentejas rojas, cebolla, ajo, berbere y aceite', allergens: 'Legumbres (lentejas)', portionSize: 'Una ración' },
      de: { name: 'Misir wat', description: 'Rote Linsen, mit Zwiebeln, Knoblauch und aromatischen Gewürzen weich geschmort.', ingredients: 'Rote Linsen, Zwiebeln, Knoblauch, Berbere und Öl', allergens: 'Hülsenfrüchte (Linsen)', portionSize: 'Eine Portion' },
    },
  };
  for (const [index, dish] of dishes.entries()) {
    let item = await prisma.menuItem.findFirst({ where: { restaurantId: restaurant.id, name: dish.name } });
    if (!item) item = await prisma.menuItem.create({ data: { ...dish, restaurantId: restaurant.id, categoryId: category.id, isFeatured: index === 0 } });
    await prisma.menuItemBranchAvailability.upsert({ where: { itemId_branchId: { itemId: item.id, branchId: branch.id } }, update: { isAvailable: true }, create: { itemId: item.id, restaurantId: restaurant.id, branchId: branch.id, isAvailable: true } });
    for (const [locale, translation] of Object.entries(dishTranslations[dish.name] ?? {})) {
      await prisma.menuItemTranslation.upsert({ where: { itemId_locale: { itemId: item.id, locale } }, update: translation, create: { itemId: item.id, locale, ...translation } });
    }
    if (dish.name === 'Doro wat') {
      let accompaniments = await prisma.modifierGroup.findFirst({ where: { itemId: item.id, name: 'Accompaniments' } });
      if (!accompaniments) accompaniments = await prisma.modifierGroup.create({ data: { itemId: item.id, name: 'Accompaniments', isRequired: false, minSelections: 0, maxSelections: 1 } });
      const groupNames: Record<string, string> = { am: 'ተጨማሪዎች', ar: 'إضافات جانبية', zh: '配菜加料', tr: 'Ek lezzetler', es: 'Acompañamientos', de: 'Beilagen' };
      for (const [locale, name] of Object.entries(groupNames)) {
        await prisma.modifierGroupTranslation.upsert({ where: { groupId_locale: { groupId: accompaniments.id, locale } }, update: { name }, create: { groupId: accompaniments.id, locale, name } });
      }
      let extraInjera = await prisma.modifierOption.findFirst({ where: { groupId: accompaniments.id, name: 'Extra injera' } });
      if (!extraInjera) extraInjera = await prisma.modifierOption.create({ data: { groupId: accompaniments.id, name: 'Extra injera', priceDelta: '25.00' } });
      const optionNames: Record<string, string> = { am: 'ተጨማሪ እንጀራ', ar: 'إينجيرا إضافية', zh: '额外英吉拉', tr: 'Ekstra injera', es: 'Injera extra', de: 'Extra Injera' };
      for (const [locale, name] of Object.entries(optionNames)) {
        await prisma.modifierOptionTranslation.upsert({ where: { optionId_locale: { optionId: extraInjera.id, locale } }, update: { name }, create: { optionId: extraInjera.id, locale, name } });
      }
    }
  }
  console.log(`Seeded ${restaurant.name} (${branch.name}), ${tableLabels.length} tables, ${dishes.length} sample menu items, demo QR http://localhost:3000/q/demo-table-01-qr-token-for-local-development-only, owner ${owner.email}, waiter ${waiter.email}, kitchen ${kitchen.email}, cashier ${cashier.email}, and admin ${admin.email}. Development credentials come from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD.`);
}
main().finally(() => prisma.$disconnect());
