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
