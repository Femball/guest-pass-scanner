export interface MenuCourse {
  key: 'starter' | 'main_course' | 'dessert';
  label: string;
  options: string[];
}

/** Choix proposés aux convives (les mets communs ne sont pas listés). */
export const MENU_COURSES: MenuCourse[] = [
  { key: 'starter', label: 'Entrée', options: ['Tartare de saumon', 'Foie gras mi-cuit'] },
  { key: 'main_course', label: 'Plat', options: ['Joue de bœuf confite', 'Pavé de saumon'] },
  { key: 'dessert', label: 'Dessert', options: ['Gâteau chocolat noir', 'Gâteau fruits rouges'] },
];

/** Mets servis à tous les convives, sans choix. */
export const MENU_COMMON = ['Kir de bienvenue', 'Velouté', 'Trou commingeois', 'Café'];

/** Tarif du menu, par personne. */
export const MENU_PRICE_PER_PERSON = 60;

/** Dernière date de modification des menus (inclus). */
export const MENU_EDIT_DEADLINE = '2026-09-15';

export const isMenuEditable = (now: Date = new Date()) =>
  now <= new Date(`${MENU_EDIT_DEADLINE}T23:59:59`);

export interface GuestMeal {
  guest_index: number;
  guest_name: string;
  starter: string;
  main_course: string;
  dessert: string;
  notes: string;
}

export const emptyMeal = (index: number): GuestMeal => ({
  guest_index: index,
  guest_name: '',
  starter: '',
  main_course: '',
  dessert: '',
  notes: '',
});

/** Ajuste la liste des convives au nombre de personnes saisi. */
export const resizeMeals = (meals: GuestMeal[], count: number): GuestMeal[] =>
  Array.from({ length: Math.max(1, count) }, (_, i) => meals[i] ?? emptyMeal(i + 1)).map((m, i) => ({
    ...m,
    guest_index: i + 1,
  }));

export const mealSummaryLabel = (meal: GuestMeal) =>
  [meal.starter, meal.main_course, meal.dessert].filter(Boolean).join(' · ');
