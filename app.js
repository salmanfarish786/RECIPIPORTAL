const RECIPES = Array.isArray(window.RECIPE_DATA) ? window.RECIPE_DATA : [];
const STOP_WORDS = new Set(["fresh", "ground", "powder", "oil", "sauce", "for", "and", "to", "of"]);
const ALIASES = { tomatoes: "tomato", chillies: "chili", chilies: "chili", yoghurt: "yogurt", coriander: "cilantro", noodles: "noodle", scallions: "scallion", peppers: "pepper" };
const FEATURED_IDS = ["vegetable-biryani", "butter-chicken", "ramen-bowl", "pad-thai", "street-tacos", "paella"];
const PHOTO_HINTS = {
  "vegetable-biryani": ["biryani", "indian", "rice"],
  "butter-chicken": ["butter-chicken", "indian", "curry"],
  "shakshuka": ["shakshuka", "eggs", "tomato"],
  "jollof-rice": ["jollof", "rice", "african"],
  "ramen-bowl": ["ramen", "japanese", "noodles"],
  "bibimbap": ["bibimbap", "korean", "rice"],
  "pho-bowl": ["pho", "vietnamese", "noodles"],
  "pad-thai": ["pad-thai", "thai", "noodles"],
  "street-tacos": ["tacos", "mexican", "food"],
  "ceviche": ["ceviche", "peruvian", "seafood"],
  "paella": ["paella", "spanish", "rice"],
  "margherita-pizza": ["pizza", "italian", "food"],
  "mushroom-risotto": ["risotto", "mushroom", "italian"],
  "shawarma-plate": ["shawarma", "middle-eastern", "chicken"],
  "beef-rendang": ["rendang", "indonesian", "beef"],
  "jerk-chicken": ["jerk-chicken", "caribbean", "grilled"],
  "nasi-lemak": ["nasi-lemak", "malaysian", "rice"],
  "laksa": ["laksa", "soup", "asian"]
};
const recipeById = new Map(RECIPES.map((recipe) => [recipe.id, recipe]));
const state = { cuisine: "All", search: "", sort: "featured" };

const elements = {
  recipeGrid: document.getElementById("recipe-grid"),
  spotlightGrid: document.getElementById("spotlight-grid"),
  cuisineFilters: document.getElementById("cuisine-filters"),
  searchInput: document.getElementById("recipe-search"),
  sortFilter: document.getElementById("sort-filter"),
  pantryForm: document.getElementById("pantry-form"),
  pantryInput: document.getElementById("pantry-input"),
  timeFilter: document.getElementById("time-filter"),
  cravingFilter: document.getElementById("craving-filter"),
  pantryEmpty: document.getElementById("pantry-empty"),
  pantryResults: document.getElementById("pantry-results"),
  fillExampleButton: document.getElementById("fill-example"),
  recipeCount: document.getElementById("recipe-count"),
  modal: document.getElementById("recipe-modal"),
  modalDialog: document.querySelector(".modal__dialog"),
  modalClose: document.getElementById("modal-close"),
  modalHero: document.getElementById("modal-hero"),
  modalPhoto: document.getElementById("modal-photo"),
  modalEyebrow: document.getElementById("modal-eyebrow"),
  modalTitle: document.getElementById("modal-title"),
  modalDescription: document.getElementById("modal-description"),
  modalMeta: document.getElementById("modal-meta"),
  modalIngredients: document.getElementById("modal-ingredients"),
  modalSteps: document.getElementById("modal-steps"),
  modalActions: document.getElementById("modal-actions"),
  modalThumbs: document.getElementById("modal-thumbs")
};

function normalizeText(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeToken(value) {
  const clean = normalizeText(value);
  return ALIASES[clean] || clean;
}

function getTokens(value) {
  return normalizeText(value)
    .split(" ")
    .map((token) => ALIASES[token] || token)
    .map((token) => {
      if (token.endsWith("ies") && token.length > 3) return token.slice(0, -3) + "y";
      if (token.endsWith("s") && !token.endsWith("ss") && token.length > 3) return token.slice(0, -1);
      return token;
    })
    .filter(Boolean)
    .filter((token) => !STOP_WORDS.has(token));
}

function ingredientMatch(pantryItems, ingredient) {
  const ingredientText = normalizeToken(ingredient);
  const ingredientTokens = getTokens(ingredient);
  return pantryItems.some((item) => {
    const pantryText = normalizeToken(item);
    if (!pantryText) return false;
    if (pantryText === ingredientText || pantryText.includes(ingredientText) || ingredientText.includes(pantryText)) return true;
    const pantryTokens = getTokens(item);
    return ingredientTokens.some((token) => pantryTokens.includes(token));
  });
}

function ingredientImageUrl(name) {
  return "https://www.themealdb.com/images/ingredients/" + encodeURIComponent(name) + "-Small.png";
}

function getImageIngredients(recipe) {
  return recipe.imageIngredients && recipe.imageIngredients.length ? recipe.imageIngredients.slice(0, 3) : recipe.ingredients.slice(0, 3);
}

function renderIngredientThumbs(items, wrapperClass) {
  if (!items || !items.length) return "";
  return '<div class="' + wrapperClass + '">' + items.map((item) => '<img loading="lazy" src="' + ingredientImageUrl(item) + '" alt="' + item + ' ingredient">').join("") + '</div>';
}

function metaPills(recipe) {
  return [
    '<span class="meta-pill">' + recipe.cuisine + '</span>',
    '<span class="meta-pill">' + recipe.category + '</span>',
    '<span class="meta-pill">' + recipe.time + ' min</span>',
    '<span class="meta-pill">' + recipe.difficulty + '</span>'
  ].join("");
}

function getYouTubeUrl(query) {
  return "https://www.youtube.com/results?search_query=" + encodeURIComponent(query);
}

function getCuisines() {
  return ["All"].concat(Array.from(new Set(RECIPES.map((recipe) => recipe.cuisine))).sort((a, b) => a.localeCompare(b)));
}

function getFeaturedRecipes() {
  const featured = FEATURED_IDS.map((id) => recipeById.get(id)).filter(Boolean);
  RECIPES.forEach((recipe) => {
    if (featured.length < 6 && !featured.includes(recipe)) featured.push(recipe);
  });
  return featured;
}

function hashString(value) {
  return Array.from(String(value || "")).reduce((total, char) => (total * 31 + char.charCodeAt(0)) % 100000, 7);
}

function photoTags(recipe) {
  const hinted = PHOTO_HINTS[recipe.id] || [];
  const titleTags = normalizeText(recipe.title).split(" ");
  const cuisineTags = normalizeText(recipe.cuisine).split(" ");
  return Array.from(new Set(hinted.concat(titleTags, cuisineTags, ["food", "meal"])))
    .filter(Boolean)
    .slice(0, 6)
    .map((tag) => tag.replace(/\s+/g, "-"));
}

function getRecipePhotoUrl(recipe) {
  // Use actual recipe image if available, otherwise fall back to generated photo
  if (recipe.image) {
    return recipe.image;
  }
  return "https://loremflickr.com/960/720/" + photoTags(recipe).join(",") + "?lock=" + hashString(recipe.id);
}

function splitTitle(title) {
  const parts = String(title || "").split(" ");
  if (parts.length <= 2) return [title];
  const pivot = Math.ceil(parts.length / 2);
  return [parts.slice(0, pivot).join(" "), parts.slice(pivot).join(" ")];
}

function getPosterDataUri(recipe) {
  const lines = splitTitle(recipe.title).slice(0, 2);
  const titleSvg = lines.map((line, index) => '<text x="72" y="' + (190 + index * 56) + '" fill="white" font-size="44" font-weight="700" font-family="Georgia, serif">' + line + '</text>').join("");
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="960" height="720" viewBox="0 0 960 720"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0%" stop-color="' + recipe.colors[0] + '"/><stop offset="100%" stop-color="' + recipe.colors[1] + '"/></linearGradient></defs><rect width="960" height="720" fill="url(#g)"/><circle cx="810" cy="120" r="180" fill="rgba(255,255,255,0.10)"/><circle cx="160" cy="610" r="150" fill="rgba(255,255,255,0.08)"/><text x="72" y="96" fill="rgba(255,255,255,0.82)" font-size="26" letter-spacing="6" font-family="Arial, sans-serif">' + recipe.cuisine.toUpperCase() + '</text>' + titleSvg + '<text x="72" y="560" fill="rgba(255,255,255,0.86)" font-size="24" font-family="Arial, sans-serif">' + recipe.time + ' MIN • ' + recipe.category.toUpperCase() + '</text><text x="72" y="620" fill="rgba(255,255,255,0.70)" font-size="22" font-family="Arial, sans-serif">Cooking Robot</text></svg>';
  return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
}

function recipePhotoMarkup(recipe, className) {
  const fallback = getPosterDataUri(recipe);
  return '<img class="' + className + '" loading="lazy" src="' + getRecipePhotoUrl(recipe) + '" alt="' + recipe.title + '" data-fallback="' + fallback + '">';
}

function bindImageFallbacks(scope) {
  const root = scope || document;
  root.querySelectorAll("img[data-fallback]").forEach((image) => {
    if (image.dataset.bound === "true") return;
    image.dataset.bound = "true";
    image.addEventListener("error", function () {
      if (image.dataset.fallbackApplied === "true") return;
      image.dataset.fallbackApplied = "true";
      image.src = image.dataset.fallback || "";
    });
  });
}

function renderCuisineFilters() {
  elements.cuisineFilters.innerHTML = getCuisines().map((cuisine) => '<button type="button" class="' + (cuisine === state.cuisine ? "is-active" : "") + '" data-cuisine="' + cuisine + '">' + cuisine + '</button>').join("");
}

function filteredRecipes() {
  const query = state.search.trim().toLowerCase();
  let list = RECIPES.filter((recipe) => {
    const cuisinePass = state.cuisine === "All" || recipe.cuisine === state.cuisine;
    const queryPass = !query || recipe.title.toLowerCase().includes(query) || recipe.cuisine.toLowerCase().includes(query) || recipe.ingredients.some((ingredient) => ingredient.toLowerCase().includes(query));
    return cuisinePass && queryPass;
  });
  if (state.sort === "quickest") list = list.slice().sort((a, b) => a.time - b.time);
  if (state.sort === "alphabetical") list = list.slice().sort((a, b) => a.title.localeCompare(b.title));
  return list;
}

function renderSpotlightGrid() {
  const picks = getFeaturedRecipes();
  elements.spotlightGrid.innerHTML = picks.map((recipe) => '<article class="spotlight-card"><div class="spotlight-card__media" style="--card-a:' + recipe.colors[0] + ';--card-b:' + recipe.colors[1] + ';">' + recipePhotoMarkup(recipe, "spotlight-card__photo") + '<div class="spotlight-card__shade"></div><div class="spotlight-card__label"><span class="meta-pill">' + recipe.cuisine + '</span><strong>' + recipe.title + '</strong><span>' + recipe.time + ' min • ' + recipe.difficulty + '</span></div>' + renderIngredientThumbs(getImageIngredients(recipe), "spotlight-card__thumbs") + '</div><div class="spotlight-card__body"><h3>' + recipe.title + '</h3><p>' + recipe.description + '</p><div class="button-row"><button class="button button--primary" type="button" data-open="' + recipe.id + '">Open recipe</button><a class="text-link" target="_blank" rel="noreferrer" href="' + getYouTubeUrl(recipe.youtubeQuery) + '">Watch on YouTube</a></div></div></article>').join("");
  bindImageFallbacks(elements.spotlightGrid);
}

function renderRecipeGrid() {
  const list = filteredRecipes();
  if (!list.length) {
    elements.recipeGrid.innerHTML = '<article class="panel empty-state"><p class="eyebrow">No match</p><h3>No recipes matched that search.</h3><p>Try a wider cuisine filter or a more general ingredient like rice, tomato, chicken, or garlic.</p></article>';
    return;
  }
  elements.recipeGrid.innerHTML = list.map((recipe) => '<article class="recipe-card"><div class="recipe-card__visual" style="--card-a:' + recipe.colors[0] + ';--card-b:' + recipe.colors[1] + ';">' + recipePhotoMarkup(recipe, "recipe-card__photo") + '<div class="recipe-card__shade"></div><span class="meta-pill">' + recipe.cuisine + '</span>' + renderIngredientThumbs(getImageIngredients(recipe), "recipe-card__thumbs") + '<strong>' + recipe.art + '</strong></div><div class="recipe-card__body"><div><h3>' + recipe.title + '</h3><p>' + recipe.description + '</p></div><div class="meta-row">' + metaPills(recipe) + '</div><div class="recipe-card__actions"><button class="button button--primary" type="button" data-open="' + recipe.id + '">Open recipe</button><a class="text-link" target="_blank" rel="noreferrer" href="' + getYouTubeUrl(recipe.youtubeQuery) + '">Watch on YouTube</a></div></div></article>').join("");
  bindImageFallbacks(elements.recipeGrid);
}

function parsePantry(value) {
  return String(value || "").split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
}

function scoreRecipe(recipe, pantryItems) {
  const matched = recipe.ingredients.filter((ingredient) => ingredientMatch(pantryItems, ingredient));
  const missing = recipe.ingredients.filter((ingredient) => !matched.includes(ingredient));
  let score = matched.length * 12 - missing.length * 2;
  const targetTime = elements.timeFilter.value;
  const craving = elements.cravingFilter.value;
  if (targetTime !== "any") {
    const limit = Number(targetTime);
    score += recipe.time <= limit ? 8 : Math.max(-12, limit - recipe.time);
  }
  if (craving !== "anything" && recipe.tags.includes(craving)) score += 8;
  return { recipe, matched, missing, score, coverage: matched.length / recipe.ingredients.length };
}

function renderPantryResults(items) {
  if (!items.length) {
    elements.pantryEmpty.hidden = false;
    elements.pantryResults.innerHTML = "";
    return;
  }
  const top = RECIPES.map((recipe) => scoreRecipe(recipe, items)).sort((a, b) => b.score - a.score).slice(0, 4);
  elements.pantryEmpty.hidden = true;
  elements.pantryResults.innerHTML = top.map((entry) => {
    const coverage = Math.round(entry.coverage * 100) + "% pantry match";
    const matchedTags = entry.matched.length ? entry.matched.map((item) => '<span>' + item + '</span>').join("") : '<span>Only a partial match so far</span>';
    const missingTags = entry.missing.length ? entry.missing.slice(0, 5).map((item) => '<span>' + item + '</span>').join("") : '<span>You already have almost everything</span>';
    return '<article class="suggestion-card"><p class="eyebrow">' + entry.recipe.cuisine + ' ' + entry.recipe.category + '</p>' + renderIngredientThumbs(getImageIngredients(entry.recipe), "recipe-card__thumbs") + '<h3>' + entry.recipe.title + '</h3><p>' + coverage + '</p><div class="inline-tags">' + matchedTags + '</div><div class="inline-tags">' + missingTags + '</div><div class="button-row"><button class="button button--primary" type="button" data-open="' + entry.recipe.id + '">Open recipe</button><a class="text-link" target="_blank" rel="noreferrer" href="' + getYouTubeUrl(entry.recipe.youtubeQuery) + '">Watch on YouTube</a></div></article>';
  }).join("");
}

function setModalPhoto(recipe) {
  elements.modalPhoto.src = getRecipePhotoUrl(recipe);
  elements.modalPhoto.alt = recipe.title + " dish";
  elements.modalPhoto.dataset.fallback = getPosterDataUri(recipe);
  elements.modalPhoto.dataset.fallbackApplied = "false";
  elements.modalPhoto.onerror = function () {
    if (elements.modalPhoto.dataset.fallbackApplied === "true") return;
    elements.modalPhoto.dataset.fallbackApplied = "true";
    elements.modalPhoto.src = elements.modalPhoto.dataset.fallback || "";
  };
}

function openRecipe(recipe) {
  elements.modal.hidden = false;
  elements.modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  elements.modalHero.style.setProperty("--card-a", recipe.colors[0]);
  elements.modalHero.style.setProperty("--card-b", recipe.colors[1]);
  elements.modalEyebrow.textContent = recipe.cuisine + " • " + recipe.category;
  elements.modalTitle.textContent = recipe.title;
  elements.modalDescription.textContent = recipe.description;
  elements.modalMeta.innerHTML = metaPills(recipe);
  elements.modalThumbs.innerHTML = getImageIngredients(recipe).map((item) => '<img loading="lazy" src="' + ingredientImageUrl(item) + '" alt="' + item + ' ingredient">').join("");
  elements.modalIngredients.innerHTML = recipe.ingredients.map((item) => '<li>' + item + '</li>').join("");
  elements.modalSteps.innerHTML = recipe.steps.map((step) => '<li>' + step + '</li>').join("");
  elements.modalActions.innerHTML = '<a class="button button--primary" target="_blank" rel="noreferrer" href="' + getYouTubeUrl(recipe.youtubeQuery) + '">Watch on YouTube</a>';
  setModalPhoto(recipe);
}

function closeRecipe() {
  elements.modal.hidden = true;
  elements.modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function bindEvents() {
  elements.searchInput.addEventListener("input", (event) => { state.search = event.target.value; renderRecipeGrid(); });
  elements.sortFilter.addEventListener("change", (event) => { state.sort = event.target.value; renderRecipeGrid(); });
  elements.cuisineFilters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-cuisine]");
    if (!button) return;
    state.cuisine = button.dataset.cuisine;
    renderCuisineFilters();
    renderRecipeGrid();
  });
  elements.pantryForm.addEventListener("submit", (event) => {
    event.preventDefault();
    renderPantryResults(parsePantry(elements.pantryInput.value));
  });
  elements.fillExampleButton.addEventListener("click", () => {
    elements.pantryInput.value = "chicken, rice, garlic, tomato, lime";
    renderPantryResults(parsePantry(elements.pantryInput.value));
  });
  document.addEventListener("click", (event) => {
    const openButton = event.target.closest("[data-open]");
    if (openButton) {
      const recipe = recipeById.get(openButton.dataset.open);
      if (recipe) openRecipe(recipe);
    }
  });
  elements.modalClose.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); closeRecipe(); });
  elements.modal.addEventListener("click", (event) => { if (event.target === elements.modal) closeRecipe(); });
  elements.modalDialog.addEventListener("click", (event) => event.stopPropagation());
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !elements.modal.hidden) closeRecipe(); });
}

function init() {
  if (!elements.recipeGrid || !elements.spotlightGrid || !elements.modal) return;
  elements.recipeCount.textContent = String(RECIPES.length);
  renderCuisineFilters();
  renderSpotlightGrid();
  renderRecipeGrid();
  renderPantryResults([]);
  bindEvents();
}

init();