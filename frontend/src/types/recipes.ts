export interface Recipe {
  slug: string
  dateCreated: string
  name: string
  author: string
  source: string
  course: string
  country: string
  vegetarian: boolean
  prepTime: string
  cookingTime: string
  calories: string
  servings: string
  ingredients: string
  instructions: string
  imageFilename: string
  imageWidth: number
  imageHeight: number
}

export interface RecipeCard {
  slug: string
  dateCreated: string
  name: string
  author: string
  source: string
  course: string
  country: string
  vegetarian: boolean
  prepTime: string
  cookingTime: string
  calories: string
  servings: string
  imageFilename: string
  imageWidth: number
  imageHeight: number
}

export const allowedCourses = [
  'baking',
  'breakfasts',
  'cocktails',
  'desserts',
  'mains',
  'salads',
  'sauces',
  'sides',
  'soups',
  'snacks',
  'seasonings',
]
