// ====== CLOUDINARY STYLE/LIGHTING CARD IMAGES ======
(function loadCloudinaryCardImages() {
  const cards = document.querySelectorAll('[data-cloudinary-tag]');
  if (!cards.length) return;

  // Collect unique tags to avoid duplicate fetches
  const tagMap = {};   // tag → [card, card, …]
  cards.forEach(card => {
    const tag = card.dataset.cloudinaryTag;
    if (!tag) return;
    if (!tagMap[tag]) tagMap[tag] = [];
    tagMap[tag].push(card);
  });

  const cloudName = (typeof CLOUDINARY_CONFIG !== 'undefined') ? CLOUDINARY_CONFIG.cloudName : 'dbtfmlmgm';
  const transforms = (typeof CLOUDINARY_CONFIG !== 'undefined') ? CLOUDINARY_CONFIG.defaultTransforms : 'f_auto,q_auto';

  Object.keys(tagMap).forEach(tag => {
    const listUrl = `https://res.cloudinary.com/${cloudName}/image/list/${encodeURIComponent(tag)}.json`;

    fetch(listUrl)
      .then(res => {
        if (!res.ok) throw new Error(`Tag "${tag}" returned ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (!data.resources || !data.resources.length) {
          console.warn(`[ImageGen] No Cloudinary images found for tag: "${tag}"`);
          return;
        }

        // Use the first image for this tag
        const resource = data.resources[0];
        const imgUrl = `https://res.cloudinary.com/${cloudName}/image/upload/${transforms}/w_400,c_fill,ar_4:3/${resource.public_id}.${resource.format}`;

        tagMap[tag].forEach(card => {
          const img = card.querySelector('img');
          if (img) {
            img.src = imgUrl;
            // Fade-in effect when loaded
            img.style.opacity = '0';
            img.style.transition = 'opacity 0.4s ease';
            img.onload = () => { img.style.opacity = '1'; };
          }
        });
      })
      .catch(err => {
        console.error(`[ImageGen] Failed to load Cloudinary image for tag "${tag}":`, err);
      });
  });
})();

//image generation df
const button = document.getElementById("generateBtn");
const loading = document.getElementById("loading");
const grid = document.getElementById("generated-image");
const imageContainer = document.getElementById("imageContainer");
let isGenerating = false;
let selectedStyle = "Cinematic";
let selectedLighting = "Golden Hour";
let currentGeneratedURL = null;
let currentGeneratedBlob = null; // keep the raw blob for base64 conversion
let navigatingToBooking = false; // flag to suppress beforeunload warning

//subject df
const subjectSelect = document.getElementById("subject-select");
const subjectOtherInput = document.getElementById("subject-other-input");

if (subjectSelect && subjectOtherInput) {
    subjectSelect.addEventListener("change", function() {
        if (this.value === "Other") {
            subjectOtherInput.classList.remove("hidden");
            subjectOtherInput.focus();
        } else {
            subjectOtherInput.classList.add("hidden");
            subjectOtherInput.value = ""; // Clear custom input if not needed
        }
    });
}

//Style Selection
const styleCards = document.querySelectorAll(".style-card");
styleCards.forEach(function(card) {
  card.onclick = function() {
    styleCards.forEach(function(c) {
      c.classList.remove("border-primary");
      c.classList.add("border-border");
    });

    card.classList.remove("border-border");
    card.classList.add("border-primary");
    selectedStyle = card.dataset.style;
  };
});

//lighting selection
const lightingCards = document.querySelectorAll(".lighting-card");
const showMoreLightingBtn = document.getElementById("show-more-lighting");
const extraLightingCards = document.querySelectorAll(".extra-lighting");
const showMoreText = document.getElementById("show-more-text");
const showMoreIcon = document.getElementById("show-more-icon");
let extraLightingVisible = false;

if (showMoreLightingBtn) {
  showMoreLightingBtn.onclick = function () {

    extraLightingVisible = !extraLightingVisible;

    extraLightingCards.forEach(function(card) {
      if (extraLightingVisible) {
        card.classList.remove("hidden");
      } else {
        card.classList.add("hidden");
      }
    });

    if (extraLightingVisible) {
      showMoreText.textContent = "Show Less";
      showMoreIcon.classList.add("ri-arrow-up-s-line");
      showMoreIcon.classList.remove("ri-arrow-down-s-line");
    } else {
      showMoreText.textContent = "Show More Options";
      showMoreIcon.classList.add("ri-arrow-down-s-line");
      showMoreIcon.classList.remove("ri-arrow-up-s-line");
    }
  };
}

lightingCards.forEach(function(card) {
  card.onclick = function () {
    lightingCards.forEach(function(c) {
      c.classList.remove("border-primary");
      c.classList.add("border-border");
    });

    card.classList.remove("border-border");
    card.classList.add("border-primary");
    selectedLighting = card.dataset.lighting;
  };
});

//camera shot selection
const cameraShotCards = document.querySelectorAll(".camera-shot-card");
cameraShotCards.forEach(function(card) {
  card.onclick = function () {
    cameraShotCards.forEach(function(c) {

      c.classList.remove("border-primary");
      c.classList.add("border-border");

    });

    card.classList.remove("border-border");
    card.classList.add("border-primary");

    selectedCameraShot = card.dataset.shot;
  };
});

/**
 * Convert a Blob to a base64 data URL string.
 */
function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ====== IMAGE GENERATOR ======
button.addEventListener("click", async (e) => {
  e.preventDefault();

  // Stop if already generating
  if (isGenerating) return;

  // ===== GET SUBJECT =====

  // store selected subject
  let subject = "";

  // check if dropdown exists
  if (subjectSelect) {

    // get selected value
    subject = subjectSelect.value.trim();
  }

  // if user picked "Other"
  if (
    subject === "Other" &&
    subjectOtherInput
  ) {

    // use custom input instead
    subject =
      subjectOtherInput.value.trim();
  }


  // ===== GET EXTRA DETAILS =====

  // default empty text
  let extraDetails = "";

  // get textarea/input
  const extraDetailsInput =
    document.getElementById(
      "extra-details-input"
    );

  // check if input exists
  if (extraDetailsInput) {

    // get user text
    extraDetails =
      extraDetailsInput.value.trim();
  }


  // ===== CONTENT MODERATION =====

  // blocked words list
  const restrictedWords = [

    "gore",
    "blood",
    "bloody",
    "kill",
    "killing",
    "dead",
    "death",
    "corpse",
    "murder",

    "torture",
    "violent",
    "violence",

    "nsfw",
    "nude",
    "naked",
    "porn",
    "porno",

    "explicit",
    "sex",
    "sexual",
    "xxx",
    "adult",

    "graphic",
    "suicide",
    "self-harm",
    "abuse",
    "trauma",

    "horror",
    "disturbing",
    "bloodshed",
    "mutilate"
  ];


  // function to check bad words
  function containsRestrictedContent(text) {

    // stop if empty
    if (!text) {
      return false;
    }

    // make lowercase
    const cleanText =
      text.toLowerCase()

      // remove symbols
      .replace(/[^\w\s]/g, "");


    // check if text contains blocked word
    return restrictedWords.some(function(word) {

      return cleanText.includes(word);

    });
  }


  // ===== CHECK CONTENT =====

  const hasRestrictedContent =

    containsRestrictedContent(subject) ||

    containsRestrictedContent(extraDetails);


  // store detected restricted words
  let detectedWords = [];


  // check every restricted word
  restrictedWords.forEach(function(word) {

    // check subject
    if (
      subject
        .toLowerCase()
        .includes(word)
    ) {

      detectedWords.push(word);
    }

    // check extra details
    if (
      extraDetails
        .toLowerCase()
        .includes(word)
    ) {

      // avoid duplicates
      if (
        !detectedWords.includes(word)
      ) {

        detectedWords.push(word);
      }
    }
  });


  // stop generation if restricted words exist
  if (detectedWords.length > 0) {

    alert(
      "Restricted words detected:\n\n" +

      detectedWords.join(", ")
    );

    return;
  }


  // ===== VALIDATION =====

  // make sure subject exists
  if (!subject) {

    alert(
      "Please enter a subject!"
    );

    return;
  }


  // ===== BUILD PROMPT =====
let prompt = `${subject}, ${selectedStyle} style, ${selectedLighting}, ${selectedCameraShot}, professional photography, high quality, detailed, realistic photography`;

  if (extraDetails) {
    prompt += `, ${extraDetails}`;
  }

  // ===== START GENERATION =====
  isGenerating = true;

  // Disable button (UI feedback)
  button.disabled = true;
  button.style.opacity = "0.5";
  button.style.cursor = "not-allowed";

  // Show loading UI
  loading.classList.remove("hidden");
  imageContainer.classList.add("hidden");
  grid.innerHTML = "";

  // Hide "Use this Image" actions while generating
  const useImageActions = document.getElementById("useImageActions");
  if (useImageActions) useImageActions.classList.add("hidden");

  //https://image-ai.formecry2219.workers.dev/
  //https://leonardo.voidking2219.workers.dev/
  //https://image-gen.nyxzrihwaseishin.workers.dev/
  //https://leonardo.arriolav78.workers.dev/

  try {
    const response = await fetch("https://image-gen.nyxzrihwaseishin.workers.dev/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ prompt })
    });

    if (!response.ok) {
      const errorData = await response.json();

      if (response.status === 429) {
        const minutes = Math.ceil(errorData.retryIn / 60);
        alert(`Limit reached. Try again in ${minutes} minute(s).`);
        return;
      }

      throw new Error(errorData.error || "Generation failed");
    }

    const blob = await response.blob();
    currentGeneratedBlob = blob;
    currentGeneratedURL = URL.createObjectURL(blob);

    const img = document.createElement("img");
    img.src = currentGeneratedURL; 
    img.className = "w-full h-auto block";

    img.onload = () => {
      imageContainer.classList.remove("hidden");
      // Show "Use this Image" actions
      if (useImageActions) useImageActions.classList.remove("hidden");
    };
    grid.appendChild(img);

  } catch (err) {
    console.error("Generation Error:", err);

    grid.innerHTML = `
      <p class="text-red-500 text-center">
        ${err.message}
      </p>
    `;

    imageContainer.classList.remove("hidden");
  } finally {
    loading.classList.add("hidden");
    isGenerating = false;
    button.disabled = false;
    button.style.opacity = "1";
    button.style.cursor = "pointer";
  }
});

// ====== "USE THIS IMAGE" BUTTON ======
const useThisImageBtn = document.getElementById("useThisImageBtn");
if (useThisImageBtn) {
  useThisImageBtn.addEventListener("click", async () => {
    if (!currentGeneratedBlob) {
      alert("No image generated yet. Please generate an image first.");
      return;
    }

    // Disable button while processing
    useThisImageBtn.disabled = true;
    const originalText = useThisImageBtn.innerHTML;
    useThisImageBtn.innerHTML = '<i class="ri-loader-4-line mr-2 animate-spin"></i> Saving...';

    try {
      // Convert blob to base64 data URL
      const dataUrl = await blobToDataURL(currentGeneratedBlob);

      // Save to localStorage
      const aiRefData = {
        dataUrl: dataUrl,
        timestamp: Date.now()
      };
      localStorage.setItem('shootgeeks_ai_ref_image', JSON.stringify(aiRefData));

      console.info('[ImageGen] AI reference image saved to localStorage.');

      // Set flag to skip beforeunload warning
      navigatingToBooking = true;

      // Switch to booking tab
      if (typeof switchTab === 'function') {
        switchTab('#booking');
      }
    } catch (err) {
      console.error('[ImageGen] Failed to save AI reference image:', err);
      alert('Failed to save image. The image may be too large. Please try again.');
    } finally {
      useThisImageBtn.disabled = false;
      useThisImageBtn.innerHTML = originalText;
    }
  });
}

// ── Warn on reload if image gen has data ──
window.addEventListener('beforeunload', (e) => {
  // Don't warn if we're intentionally navigating to booking
  if (navigatingToBooking) return;

  const subjectVal = subjectSelect ? subjectSelect.value : '';
  const extraVal = document.getElementById('extra-details-input');
  const hasData = (subjectVal && subjectVal !== '') ||
                  (extraVal && extraVal.value.trim()) ||
                  currentGeneratedURL !== null ||
                  isGenerating;
  if (hasData) {
    e.preventDefault();
    e.returnValue = '';
  }
});