export type ModifierOption = { id: string; name: string; priceDelta: string };
export type ModifierGroup = { id: string; name: string; required: boolean; min: number; max: number; options: ModifierOption[] };
export type MenuItem = { id: string; name: string; description: string | null; ingredients: string | null; allergens: string | null; portionSize: string | null; price: string; imageUrl: string | null; available: boolean; dietaryLabels: string[]; spiceLevel: number | null; featured: boolean; modifiers: ModifierGroup[] };
export type Menu = { restaurant: { name: string; description: string | null; logoUrl: string | null; coverImageUrl: string | null; slug: string; currency: string }; branch: { name: string }; table: { label: string }; categories: { id: string; name: string; items: MenuItem[] }[] };
export type CartLine = { key: string; item: MenuItem; quantity: number; selected: Record<string, string[]>; instructions: string };
