(function () {
  const STORAGE_KEY = "vykonak-kalkulator-v2";
  const RECORDS_KEY = "vykonak-denni-zaznamy-v1";
  const CALC_VIBRATION_KEY = "vykonak-calculator-vibration";
  const DEFAULT_RATE = 45;
  const DEFAULT_HOURS = 6;
  const DEFAULT_PRODUCTION_COLOR = "blue";
  const PREFERRED_PRODUCT_ROWS = 2;
  const DEFAULT_BOX_COMPLETION_LIMIT = 10;

  const state = loadState() || {
    people: [
      { id: uid(), name: "Já", rate: 45, hours: 6, fixedPieces: 0, fixedProduct: "", keeper: true },
      { id: uid(), name: "Kolega 1", rate: 45, hours: 6, fixedPieces: 0, fixedProduct: "", keeper: false },
      { id: uid(), name: "Kolega 2", rate: 25, hours: 6, fixedPieces: 0, fixedProduct: "", keeper: false },
      { id: uid(), name: "Kolega 3", rate: 50, hours: 6, fixedPieces: 0, fixedProduct: "", keeper: false }
    ],
    products: [
      { id: uid(), name: "", pieces: 0, noteType: "", notePieces: 0, note: "", color: "" }
    ],
    settings: {
      minRecordHours: 0.5,
      boxCompletionLimit: DEFAULT_BOX_COMPLETION_LIMIT,
      productionColor: DEFAULT_PRODUCTION_COLOR
    }
  };

  const PERSON_NAME_SUGGESTIONS = [
    "Absolon",
    "Abrla",
    "Bálek",
    "Bartošová",
    "Beran",
    "Borková",
    "Doudová",
    "Dostálová",
    "Davidová",
    "Fejt",
    "Giňová",
    "Golemba",
    "Habrman",
    "Helbichová",
    "Hildebrand",
    "Hommerová",
    "Horská",
    "Hrabáková",
    "Hurtová",
    "Hustý",
    "Jankelová Adéla",
    "Jankelová",
    "Janků",
    "Jeníková",
    "Ješina",
    "Jirásek",
    "Junková",
    "Jurajda",
    "Kašparová",
    "Kolář",
    "Koutná",
    "Krištofová",
    "Kuruová",
    "Kutra",
    "Limberská",
    "Luďa Tomáš",
    "Maťátko",
    "Marková",
    "Morávková",
    "Naďa",
    "Netopil",
    "Novotná",
    "Pávková",
    "Pechancová",
    "Petráňová",
    "Petružálková",
    "Prokopová",
    "Přibula",
    "Raduška",
    "Roušar",
    "Rybková",
    "Řehák",
    "Sedláčková",
    "Sejkorová",
    "Svatošová",
    "Šilarová",
    "Štěpánka",
    "Štosková",
    "Tošovská",
    "Vaňous Pavel",
    "Vaňous Petr",
    "Večeřová",
    "Venclová",
    "Vintrová",
    "Vodrážková",
    "Zdenulka Tomáš",
    "Zezulová"
  ];
  const CALC_VARIANT_COUNT = 3;

  normalizeState(state);

  const els = {
    peopleRows: document.querySelector("#peopleRows"),
    productRows: document.querySelector("#productRows"),
    todayInfo: document.querySelector("#todayInfo"),
    personTemplate: document.querySelector("#personTemplate"),
    productTemplate: document.querySelector("#productTemplate"),
    totalPieces: document.querySelector("#totalPieces"),
    productTotal: document.querySelector("#productTotal"),
    totalCapacity: document.querySelector("#totalCapacity"),
    capacityDelta: document.querySelector("#capacityDelta"),
    productPanel: document.querySelector("#productPanel"),
    productionColor: document.querySelector("#productionColor"),
    productPicker: document.querySelector("#productPicker"),
    minRecordHours: document.querySelector("#minRecordHours"),
    boxCompletionLimit: document.querySelector("#boxCompletionLimit"),
    warnings: document.querySelector("#warnings"),
    results: document.querySelector("#results"),
    quickProducts: document.querySelector("#quickProducts"),
    productionPlanner: document.querySelector("#productionPlanner"),
    plannerRows: document.querySelector("#plannerRows"),
    plannerPreview: document.querySelector("#plannerPreview"),
    plannerTotal: document.querySelector("#plannerTotal"),
    plannerTarget: document.querySelector("#plannerTarget"),
    plannerCompletion: document.querySelector("#plannerCompletion"),
    plannerCompletionTitle: document.querySelector("#plannerCompletionTitle"),
    plannerCompletionDetail: document.querySelector("#plannerCompletionDetail"),
    completePlannerBox: document.querySelector("#completePlannerBox"),
    nextProductionPlanVariant: document.querySelector("#nextProductionPlanVariant"),
    plannerVariantInfo: document.querySelector("#plannerVariantInfo"),
    applyProductionPlan: document.querySelector("#applyProductionPlan"),
    installPanel: document.querySelector("#installPanel"),
    installAndroid: document.querySelector("#installAndroid"),
    installApple: document.querySelector("#installApple"),
    installApp: document.querySelector("#installApp"),
    installSheet: document.querySelector("#installSheet"),
    installGuideTitle: document.querySelector("#installGuideTitle"),
    installGuideContent: document.querySelector("#installGuideContent"),
    installGuideClose: document.querySelector("#installGuideClose"),
    calcSheet: document.querySelector("#calcSheet"),
    calcExpression: document.querySelector("#calcExpression"),
    calcResult: document.querySelector("#calcResult"),
    calcApply: document.querySelector("#calcApply"),
    calcClose: document.querySelector("#calcClose"),
    calcVibration: document.querySelector("#calcVibration"),
    standaloneCalc: document.querySelector("#standaloneCalc"),
    calculate: document.querySelector("#calculate"),
    calculateBottom: document.querySelector("#calculateBottom"),
    saveRecord: document.querySelector("#saveRecord"),
    loadRecord: document.querySelector("#loadRecord"),
    recordSheet: document.querySelector("#recordSheet"),
    recordList: document.querySelector("#recordList"),
    recordClose: document.querySelector("#recordClose"),
    openHelp: document.querySelector("#openHelp"),
    helpSheet: document.querySelector("#helpSheet"),
    helpClose: document.querySelector("#helpClose")
  };

  let deferredInstallPrompt = null;
  let activeCalculator = null;
  let calculatorJustEvaluated = false;
  let lastCalculationSignature = "";
  let calculationVariant = 0;
  let plannerBoxSize = 168;
  let plannerVariant = 0;
  let productionPlanVariants = [];
  let latestProductionPlan = [];
  let plannerCompletionOffer = null;
  let completedProductionPlan = null;

  document.querySelector("#addPerson").addEventListener("click", () => {
    state.people.push({
      id: uid(),
      name: "",
      rate: DEFAULT_RATE,
      hours: DEFAULT_HOURS,
      fixedPieces: DEFAULT_RATE * DEFAULT_HOURS,
      fixedProduct: "",
      keeper: false,
      capacitySource: "target"
    });
    render();
  });

  document.querySelector("#addProduct").addEventListener("click", () => {
    toggleProductPicker();
  });

  els.nextProductionPlanVariant.addEventListener("click", () => {
    if (productionPlanVariants.length <= 1) return;
    completedProductionPlan = null;
    plannerVariant = (plannerVariant + 1) % productionPlanVariants.length;
    updateProductionPlanner();
  });
  els.applyProductionPlan.addEventListener("click", applyProductionPlan);
  els.completePlannerBox.addEventListener("click", () => {
    const offer = plannerCompletionOffer;
    if (!offer) return;
    completedProductionPlan = {
      source: plannerSourceSignature(),
      offer,
      plan: latestProductionPlan.map((item) => ({
        ...item,
        pieces: item.pieces + (item.name === offer.name ? offer.extra : 0)
      }))
    };
    updateProductionPlanner();
    applyProductionPlan();
  });

  els.productionPlanner.querySelectorAll("[data-box-size]").forEach((button) => {
    button.addEventListener("click", () => {
      plannerBoxSize = Number(button.dataset.boxSize) || 168;
      updatePlannerBoxButtons();
      clampPlannerRemainders();
      updateProductionPlanner(true);
    });
  });

  els.plannerRows.addEventListener("click", (event) => {
    const stepButton = event.target.closest("[data-plan-step]");
    if (!stepButton) return;
    const row = stepButton.closest("[data-plan-product]");
    const current = Number(row.dataset.boxCount || 0);
    row.dataset.boxCount = String(Math.max(0, current + Number(stepButton.dataset.planStep)));
    updatePlannerRow(row);
    updateProductionPlanner(true);
  });

  els.plannerRows.addEventListener("input", (event) => {
    if (event.target.matches("[data-plan-enabled]")) {
      updatePlannerRow(event.target.closest("[data-plan-product]"));
      updateProductionPlanner(true);
      return;
    }
    if (!event.target.matches("[data-plan-remainder]")) return;
    event.target.value = String(clampNumber(event.target.value, 0, plannerBoxSize - 1));
    updateProductionPlanner(true);
  });

  els.productPicker.addEventListener("click", (event) => {
    const choice = event.target.closest("[data-product-choice]");
    if (!choice) return;
    addProductRow(choice.dataset.productChoice || "");
    closeProductPicker();
  });

  document.addEventListener("click", (event) => {
    if (event.target.closest("#addProduct") || event.target.closest("#productPicker")) return;
    closeProductPicker();
  });

  document.querySelector("#appendQuickProducts").addEventListener("click", () => {
    applyQuickProducts(false);
  });

  document.querySelector("#replaceQuickProducts").addEventListener("click", () => {
    applyQuickProducts(true);
  });

  els.calculate.addEventListener("click", () => {
    handleCalculate(false);
  });

  els.calculateBottom.addEventListener("click", () => {
    handleCalculate(true);
  });

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    els.installApp.hidden = false;
    updateInstallButtons();
  });

  els.installAndroid.addEventListener("click", installOnAndroid);
  els.installApple.addEventListener("click", () => openInstallGuide("ios"));
  els.installGuideClose.addEventListener("click", closeInstallGuide);
  els.installSheet.querySelector("[data-install-close]").addEventListener("click", closeInstallGuide);
  els.installApp.addEventListener("click", installOnAndroid);

  async function installOnAndroid() {
    if (isStandaloneApp()) {
      openInstallGuide("installed");
      return;
    }
    if (!deferredInstallPrompt) {
      openInstallGuide("android");
      return;
    }
    els.installAndroid.disabled = true;
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice.catch(() => null);
    deferredInstallPrompt = null;
    els.installApp.hidden = true;
    els.installAndroid.disabled = false;
    updateInstallButtons();
  }

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    els.installApp.hidden = true;
    updateInstallButtons();
  });

  document.querySelector("#resetApp").addEventListener("click", () => {
    if (!confirm("Opravdu chcete vymazat údaje?")) return;
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  });

  document.querySelector("#closeApp").addEventListener("click", async () => {
    const capacitor = window.Capacitor;
    const nativeApp = capacitor && capacitor.Plugins && capacitor.Plugins.App;
    if (nativeApp && typeof capacitor.isNativePlatform === "function" && capacitor.isNativePlatform()) {
      await nativeApp.exitApp();
      return;
    }

    window.close();
    window.setTimeout(() => {
      if (!document.hidden) alert("Prohlížeč nedovolil stránce zavřít ručně otevřenou kartu. Zavřete ji křížkem prohlížeče.");
    }, 250);
  });

  els.calcClose.addEventListener("click", closeCalculator);
  els.calcSheet.querySelector("[data-calc-close]").addEventListener("click", closeCalculator);
  els.calcExpression.addEventListener("input", updateCalculatorResult);
  els.calcVibration.checked = localStorage.getItem(CALC_VIBRATION_KEY) !== "off";
  els.calcVibration.addEventListener("change", () => {
    localStorage.setItem(CALC_VIBRATION_KEY, els.calcVibration.checked ? "on" : "off");
    vibrateCalculator(els.calcVibration.checked ? 20 : 0);
  });
  els.calcApply.addEventListener("click", applyCalculator);
  els.calcSheet.addEventListener("click", (event) => {
    const keyButton = event.target.closest("[data-calc-key]");
    if (keyButton) {
      enterCalculatorKey(keyButton.dataset.calcKey);
      vibrateCalculator();
      return;
    }
    if (event.target.closest("[data-calc-backspace]")) {
      els.calcExpression.value = els.calcExpression.value.slice(0, -1);
      calculatorJustEvaluated = false;
      updateCalculatorResult();
      vibrateCalculator();
      return;
    }
    if (event.target.closest("[data-calc-equals]")) {
      commitCalculatorResult();
      return;
    }
    if (event.target.closest("[data-calc-clear]")) {
      els.calcExpression.value = "";
      calculatorJustEvaluated = false;
      updateCalculatorResult();
      vibrateCalculator(24);
    }
  });
  els.standaloneCalc.addEventListener("click", openStandaloneCalculator);
  els.saveRecord.addEventListener("click", saveDailyRecord);
  els.loadRecord.addEventListener("click", openRecordLoader);
  els.recordClose.addEventListener("click", closeRecordLoader);
  els.recordSheet.querySelector("[data-record-close]").addEventListener("click", closeRecordLoader);
  els.openHelp.addEventListener("click", openHelp);
  els.helpClose.addEventListener("click", closeHelp);
  els.helpSheet.querySelector("[data-help-close]").addEventListener("click", closeHelp);

  els.minRecordHours.addEventListener("change", () => {
    state.settings.minRecordHours = Number(els.minRecordHours.value);
    saveAndUpdateSummary();
  });

  els.boxCompletionLimit.addEventListener("change", () => {
    state.settings.boxCompletionLimit = Number(els.boxCompletionLimit.value);
    saveAndUpdateSummary();
  });

  els.productionColor.addEventListener("change", () => {
    const previous = normalizeProductionColor(state.settings.productionColor || "");
    state.settings.productionColor = els.productionColor.value;
    const current = normalizeProductionColor(state.settings.productionColor || "");
    if (isUlProductionColor(current)) {
      state.products.forEach((product) => {
        if (!product.pieces || product.pieces === 168) product.pieces = 180;
      });
    } else if (isUlProductionColor(previous)) {
      state.products.forEach((product) => {
        if (product.pieces === 180) product.pieces = 168;
      });
    }
    render();
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {});
      updateInstallButtons();
    });
  }

  updateInstallButtons();

  render();
  restoreCalculation();

  function handleCalculate(scrollToResults) {
    storeCalculation(calculateNextPlan());
    if (scrollToResults) {
      document.querySelector("#results").scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function setCalculateVariantHint(enabled) {
    [els.calculate, els.calculateBottom].forEach((button) => {
      button.classList.toggle("has-variant-hint", enabled);
      button.setAttribute(
        "aria-label",
        enabled ? "Spočítat další variantu" : "Spočítat"
      );
    });
  }

  function render() {
    updateTodayInfo();
    els.minRecordHours.value = String(state.settings.minRecordHours);
    els.boxCompletionLimit.value = String(state.settings.boxCompletionLimit);
    els.productionColor.value = normalizeProductionColor(state.settings.productionColor);
    applyProductionColor();
    renderPeople();
    renderProducts();
    saveAndUpdateSummary();
  }

  function updateTodayInfo() {
    const now = new Date();
    els.todayInfo.textContent = new Intl.DateTimeFormat("cs-CZ", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }).format(now);
  }

  function renderPeople() {
    els.peopleRows.replaceChildren();
    state.people.forEach((person) => {
      const node = els.personTemplate.content.firstElementChild.cloneNode(true);
      setInput(node, "name", person.name);
      setInput(node, "rate", person.rate);
      setInput(node, "hours", person.hours);
      setInput(node, "fixedPieces", person.fixedPieces || "");
      setInput(node, "fixedProduct", person.fixedProduct || "");
      setInput(node, "keeper", person.keeper);
      const nameInput = node.querySelector('[data-field="name"]');
      const rateInput = node.querySelector('[data-field="rate"]');
      const hoursInput = node.querySelector('[data-field="hours"]');
      const targetInput = node.querySelector('[data-field="fixedPieces"]');
      const nameSuggestions = node.querySelector(".name-suggestions");
      const capacityHint = node.querySelector("[data-capacity-hint]");
      updateCapacityHint(capacityHint, person);

      node.addEventListener("input", (event) => {
        const field = event.target.dataset.field;
        if (!field) return;
        if (field === "keeper") {
          person.keeper = event.target.checked;
        } else if (field === "name") {
          person.name = event.target.value;
          renderNameSuggestions(nameInput, nameSuggestions, person);
        } else if (field === "fixedProduct") {
          person.fixedProduct = event.target.value;
        } else {
          person[field] = Number(event.target.value);
          if (["fixedPieces", "rate", "hours"].includes(field)) {
            synchronizePersonCapacity(person, field);
            if (field !== "fixedPieces") targetInput.value = formatInputValue(person.fixedPieces);
            if (field !== "rate") rateInput.value = formatInputValue(person.rate);
          }
        }
        updateCapacityHint(capacityHint, person);
        saveAndUpdateSummary();
      });

      [targetInput, rateInput, hoursInput].forEach((input) => {
        input.addEventListener("blur", () => {
          ensurePersonCapacityValues(person);
          targetInput.value = formatInputValue(person.fixedPieces);
          rateInput.value = formatInputValue(person.rate);
          hoursInput.value = formatInputValue(person.hours);
          updateCapacityHint(capacityHint, person);
          saveAndUpdateSummary();
        });
      });

      nameInput.addEventListener("focus", () => {
        renderNameSuggestions(nameInput, nameSuggestions, person);
      });

      nameInput.addEventListener("blur", () => {
        setTimeout(() => {
          nameSuggestions.hidden = true;
        }, 120);
      });

      node.querySelector(".remove-row").addEventListener("click", () => {
        state.people = state.people.filter((item) => item.id !== person.id);
        render();
      });

      els.peopleRows.append(node);
    });
  }

  function updateCapacityHint(container, person) {
    if (!container) return;
    const rate = numberOrZero(person.rate);
    const hours = numberOrZero(person.hours);
    const fixedPieces = Math.round(numberOrZero(person.fixedPieces));
    const fixedProduct = String(person.fixedProduct || "").trim();
    const parts = [];

    if (fixedPieces > 0 && hours > 0) {
      parts.push(`Cíl: ${fixedPieces} ks celkem = ${formatNumber(fixedPieces / hours)} ks/h při ${formatNumber(hours)} h`);
    } else if (rate > 0 && hours > 0) {
      parts.push(`Kapacita: ${formatNumber(rate)} ks/h x ${formatNumber(hours)} h = ${Math.round(rate * hours)} ks`);
    }

    if (fixedPieces > 0 && fixedProduct) {
      parts.push(`z výrobku ${fixedProduct}`);
    }

    container.textContent = parts.join(" | ");
  }

  function synchronizePersonCapacity(person, editedField) {
    const target = Math.round(numberOrZero(person.fixedPieces));
    const rate = numberOrZero(person.rate);
    const hours = numberOrZero(person.hours);

    if (editedField === "fixedPieces") {
      person.capacitySource = "target";
      if (target > 0 && hours > 0) person.rate = roundRate(target / hours);
      return;
    }

    if (editedField === "rate") {
      person.capacitySource = "rate";
      if (rate > 0 && hours > 0) person.fixedPieces = Math.round(rate * hours);
      return;
    }

    if (editedField === "hours" && hours > 0) {
      if (person.capacitySource === "rate" && rate > 0) {
        person.fixedPieces = Math.round(rate * hours);
      } else if (target > 0) {
        person.rate = roundRate(target / hours);
      }
    }
  }

  function ensurePersonCapacityValues(person) {
    if (numberOrZero(person.hours) <= 0) person.hours = DEFAULT_HOURS;

    if (numberOrZero(person.fixedPieces) > 0) {
      if (person.capacitySource === "rate" && numberOrZero(person.rate) > 0) {
        synchronizePersonCapacity(person, "rate");
      } else {
        person.capacitySource = "target";
        synchronizePersonCapacity(person, "fixedPieces");
      }
      return;
    }

    if (numberOrZero(person.rate) <= 0) person.rate = DEFAULT_RATE;
    person.capacitySource = "rate";
    synchronizePersonCapacity(person, "rate");
  }

  function roundRate(value) {
    return Math.round(numberOrZero(value) * 10) / 10;
  }

  function formatInputValue(value) {
    return numberOrZero(value) > 0 ? String(value) : "";
  }

  function renderNameSuggestions(input, container, person) {
    const matches = findPersonNameMatches(input.value);
    if (!matches.length) {
      container.hidden = true;
      container.replaceChildren();
      return;
    }

    container.replaceChildren(...matches.map((name) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = name;
      button.addEventListener("mousedown", (event) => event.preventDefault());
      button.addEventListener("click", () => {
        person.name = name;
        input.value = name;
        container.hidden = true;
        saveAndUpdateSummary();
      });
      return button;
    }));
    container.hidden = false;
  }

  function findPersonNameMatches(value) {
    const query = normalizeNameSearch(value);
    if (!query) return [];
    return PERSON_NAME_SUGGESTIONS
      .filter((name) => {
        const normalized = normalizeNameSearch(name);
        return normalized.startsWith(query) && normalized !== query;
      })
      .sort((a, b) => a.localeCompare(b, "cs"))
      .slice(0, 6);
  }

  function normalizeNameSearch(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function renderProducts() {
    els.productRows.replaceChildren();
    state.products.forEach((product) => {
      fillProductInfoPieces(product);
      const node = els.productTemplate.content.firstElementChild.cloneNode(true);
      setInput(node, "name", product.name);
      setInput(node, "pieces", product.pieces);
      setInput(node, "noteType", product.noteType || "");
      setInput(node, "note", product.note || "");
      const syncPartialInputs = () => {
        const combined = product.noteType === "doplneno-rozpracovana";
        node.classList.toggle("has-combined-info", combined);
        node.querySelector(".product-partials").hidden = !combined;
        const invalid = combined && Boolean(productPartialError(product));
        node.querySelectorAll(".product-partials input").forEach((input) => {
          if (document.activeElement !== input) input.value = String(product[input.dataset.field] || 0);
          input.max = String(productBoxPieces(product) - 1);
          input.setAttribute("aria-invalid", String(invalid));
        });
      };
      syncPartialInputs();
      const noteToggle = node.querySelector(".info-toggle");
      const noteField = node.querySelector(".product-note");
      const breakdown = node.querySelector(".product-breakdown");
      const noteOpen = Boolean(product.noteOpen || product.note);
      noteField.hidden = !noteOpen;
      noteToggle.classList.toggle("is-active", noteOpen);
      updateProductBreakdown(product, breakdown);

      node.addEventListener("input", (event) => {
        const field = event.target.dataset.field;
        if (!field) return;
        const previousType = product.noteType;
        if (["noteType", "notePieces", "unfinishedPieces"].includes(field)) delete product.startingPieces;
        if (field === "name" || field === "noteType" || field === "note") {
          product[field] = event.target.value;
        } else {
          product[field] = Number(event.target.value);
        }
        if (field === "noteType" || field === "pieces") {
          if (field === "noteType" && product.noteType === "doplneno-rozpracovana" && previousType === "rozpracovana") {
            product.unfinishedPieces = product.notePieces || 0;
            product.notePieces = 0;
          }
          fillProductInfoPieces(product, field === "noteType");
          if (field === "pieces") setInput(node, "noteType", product.noteType || "");
        }
        if (field === "notePieces" || field === "unfinishedPieces") {
          balanceProductPartials(product, field);
        }
        syncPartialInputs();
        updateProductBreakdown(product, breakdown);
        saveAndUpdateSummary();
      });

      node.querySelector(".remove-row").addEventListener("click", () => {
        state.products = state.products.filter((item) => item.id !== product.id);
        render();
      });

      node.querySelector(".calc-open").addEventListener("click", () => {
        openCalculator(node.querySelector('[data-field="pieces"]'), (value) => {
          product.pieces = value;
          fillProductInfoPieces(product);
          setInput(node, "noteType", product.noteType || "");
          syncPartialInputs();
          updateProductBreakdown(product, breakdown);
          saveAndUpdateSummary();
        });
      });

      noteToggle.addEventListener("click", () => {
        product.noteOpen = noteField.hidden;
        noteField.hidden = !product.noteOpen;
        noteToggle.classList.toggle("is-active", product.noteOpen);
        saveAndUpdateSummary();
      });

      els.productRows.append(node);
    });
  }

  function addProductRow(name = "") {
    state.products.push({ id: uid(), name, pieces: defaultBoxPieces(), noteType: "", notePieces: 0, note: "" });
    render();
  }

  function toggleProductPicker() {
    const isOpen = !els.productPicker.hidden;
    els.productPicker.hidden = isOpen;
    document.querySelector("#addProduct").setAttribute("aria-expanded", String(!isOpen));
  }

  function closeProductPicker() {
    if (els.productPicker.hidden) return;
    els.productPicker.hidden = true;
    document.querySelector("#addProduct").setAttribute("aria-expanded", "false");
  }

  function applyProductionColor() {
    els.productPanel.classList.remove(
      "product-color-green-ul",
      "product-color-blue",
      "product-color-yellow",
      "product-color-honey",
      "product-color-gold",
      "product-color-orange",
      "product-color-pink",
      "product-color-bordeaux"
    );
    const color = normalizeProductionColor(state.settings.productionColor || "");
    if (color) els.productPanel.classList.add(`product-color-${color}`);
  }

  function defaultBoxPieces() {
    const color = normalizeProductionColor(state.settings.productionColor || "");
    return isUlProductionColor(color) ? 180 : 168;
  }

  function fillProductInfoPieces(product, force = false) {
    if (Number.isInteger(product.startingPieces)) {
      const split = splitShiftProduction(product.pieces, product.startingPieces, productBoxPieces(product));
      product.noteType = split.completed > 0
        ? split.unfinished > 0 ? "doplneno-rozpracovana" : "doplneno"
        : split.unfinished > 0 ? "rozpracovana" : "";
      product.notePieces = split.completed || split.unfinishedNew;
      product.unfinishedPieces = split.unfinishedNew;
      return;
    }
    if (product.noteType === "doplneno-rozpracovana") {
      balanceProductPartials(product);
      return;
    }
    if (!product.noteType || !["doplneno", "rozpracovana"].includes(product.noteType)) return;

    const boxPieces = productBoxPieces(product);
    const pieces = Math.round(numberOrZero(product.pieces));
    if (!pieces || !boxPieces) return;

    if (!force && product.noteType === "doplneno" && product.notePieces > 0) {
      product.unfinishedPieces = Math.max(0, pieces - product.notePieces) % boxPieces;
      if (product.unfinishedPieces > 0) product.noteType = "doplneno-rozpracovana";
      return;
    }

    const remainder = pieces % boxPieces;
    if (!remainder) {
      product.notePieces = "";
      return;
    }

    product.notePieces = remainder;
  }

  function balanceProductPartials(product, editedField = "notePieces") {
    if (product.noteType !== "doplneno-rozpracovana") return;
    const pieces = Math.max(0, Math.round(numberOrZero(product.pieces)));
    const edited = numberOrZero(product[editedField]);
    if (!Number.isInteger(edited) || edited < 0 || edited > pieces || edited >= productBoxPieces(product)) return;
    const otherField = editedField === "unfinishedPieces" ? "notePieces" : "unfinishedPieces";
    product[otherField] = (pieces - edited) % productBoxPieces(product);
  }

  function productBoxPieces(product) {
    return [168, 180].includes(product.boxSize) ? product.boxSize : defaultBoxPieces();
  }

  // Only new pieces count toward the shift; inherited pieces still complete a physical box.
  function splitShiftProduction(pieces, startingPieces, boxSize) {
    const made = Math.max(0, Math.round(numberOrZero(pieces)));
    const inherited = clampNumber(startingPieces, 0, boxSize - 1);
    const needed = inherited > 0 ? boxSize - inherited : 0;
    const completed = needed > 0 && made >= needed ? needed : 0;
    const stillInFirstBox = inherited > 0 && made < needed;
    const remaining = made - completed;
    const wholeBoxes = stillInFirstBox ? 0 : Math.floor(remaining / boxSize);
    const unfinishedNew = stillInFirstBox ? made : remaining % boxSize;
    return {
      inherited,
      completed,
      wholeBoxes,
      unfinishedNew,
      unfinished: stillInFirstBox ? inherited + made : unfinishedNew,
      deliveredBoxes: wholeBoxes + (completed > 0 ? 1 : 0)
    };
  }

  function updateProductBreakdown(product, element) {
    if (!element) return;
    const error = productPartialError(product);
    element.classList.toggle("has-error", Boolean(error));
    if (error) {
      element.textContent = error;
      return;
    }
    const description = describeProductBreakdown(product);
    const summary = document.createElement("strong");
    summary.textContent = description.summary;
    const details = document.createElement("span");
    details.textContent = description.details.join(" | ");
    element.replaceChildren(summary, details);
  }

  function productPartialError(product) {
    if (product.noteType !== "doplneno-rozpracovana") return "";
    const completed = numberOrZero(product.notePieces);
    const unfinished = numberOrZero(product.unfinishedPieces);
    if (completed < 0 || unfinished < 0 || !Number.isInteger(completed) || !Number.isInteger(unfinished)) {
      return "Počty kusů musí být celá nezáporná čísla.";
    }
    if (completed >= productBoxPieces(product) || unfinished >= productBoxPieces(product)) {
      return `Jednotlivá část musí být menší než bedna (${productBoxPieces(product)} ks).`;
    }
    const excess = completed + unfinished - Math.round(numberOrZero(product.pieces));
    return excess > 0 ? `Doplněno a rozpracováno přesahují celkový počet o ${excess} ks.` : "";
  }

  function describeProductBreakdown(product) {
    const boxPieces = productBoxPieces(product);
    if (Number.isInteger(product.startingPieces)) {
      const split = splitShiftProduction(product.pieces, product.startingPieces, boxPieces);
      const details = [];
      if (split.inherited > 0) details.push(`Po předchozí směně: ${split.inherited} ks`);
      if (split.completed > 0) details.push(`Doplněno: ${split.completed} ks`);
      if (split.wholeBoxes > 0) details.push(`Celé: ${split.wholeBoxes} ${formatBoxWord(split.wholeBoxes)} (${split.wholeBoxes * boxPieces} ks)`);
      if (split.unfinished > 0) {
        details.push(`Rozpracováno: ${split.unfinished} ks` + (split.unfinished !== split.unfinishedNew ? ` (dnes ${split.unfinishedNew} ks)` : ""));
      }
      return { summary: `Odevzdáno: ${split.deliveredBoxes} ${formatBoxWord(split.deliveredBoxes)}`, details };
    }
    const pieces = Math.max(0, Math.round(numberOrZero(product.pieces)));
    const combined = product.noteType === "doplneno-rozpracovana";
    const manualPart = Math.max(0, Math.round(numberOrZero(product.notePieces)));
    const part = manualPart > 0 ? Math.min(manualPart, pieces) : pieces % boxPieces;
    const completed = combined ? manualPart : product.noteType === "doplneno" ? part : 0;
    const unfinished = combined
      ? Math.max(0, Math.round(numberOrZero(product.unfinishedPieces)))
      : product.noteType === "doplneno" ? 0 : product.noteType === "rozpracovana" ? part : pieces % boxPieces;
    const wholeBase = pieces - completed - unfinished;
    const wholeBoxes = Math.max(0, Math.floor(wholeBase / boxPieces));
    const deliveredBoxes = wholeBoxes + (completed > 0 ? 1 : 0);
    const details = [];
    if (completed > 0) details.push(`Doplněno: ${completed} ks`);
    if (wholeBoxes > 0) details.push(`Celé: ${wholeBoxes} ${formatBoxWord(wholeBoxes)} (${wholeBoxes * boxPieces} ks)`);
    if (unfinished > 0) details.push(`Rozpracováno: ${unfinished} ks`);
    return {
      summary: `Odevzdáno: ${deliveredBoxes} ${formatBoxWord(deliveredBoxes)}`,
      details
    };
  }

  function normalizeState(data) {
    data.settings = data.settings || {};
    delete data.settings.maxRows;
    if (![0.25, 0.5, 1].includes(Number(data.settings.minRecordHours))) {
      data.settings.minRecordHours = 0.5;
    }
    if (data.settings.boxCompletionLimit == null || ![0, 5, 10, 15, 20, 25, 30].includes(Number(data.settings.boxCompletionLimit))) {
      data.settings.boxCompletionLimit = DEFAULT_BOX_COMPLETION_LIMIT;
    }
    if (!("productionColor" in data.settings)) {
      const colored = (data.products || []).find((product) => product.color);
      data.settings.productionColor = colored ? colored.color : "";
    }
    data.settings.productionColor = normalizeProductionColor(data.settings.productionColor || "");
    data.products = (data.products || []).map((product) => {
      const { color, ...rest } = product;
      if (rest.name === "C doplneno") rest.name = "C doplněno";
      migrateProductNote(rest);
      return rest;
    });
    data.people = (data.people || []).map((person) => {
      const normalized = {
        ...person,
        name: person.name === "Ja" ? "Já" : person.name,
        rate: numberOrZero(person.rate),
        hours: numberOrZero(person.hours) || DEFAULT_HOURS,
        fixedPieces: Math.round(numberOrZero(person.fixedPieces)),
        fixedProduct: person.fixedProduct || "",
        capacitySource: person.capacitySource || (numberOrZero(person.fixedPieces) > 0 ? "target" : "rate")
      };
      ensurePersonCapacityValues(normalized);
      return normalized;
    });
  }

  function normalizeProductionColor(color) {
    if (color === "gold") return "honey";
    return color || DEFAULT_PRODUCTION_COLOR;
  }

  function isUlProductionColor(color) {
    return ["green-ul", "honey", "bordeaux"].includes(normalizeProductionColor(color));
  }

  function migrateProductNote(product) {
    product.note = product.note || "";
    product.noteType = product.noteType || "";
    product.notePieces = Math.round(numberOrZero(product.notePieces));
    product.unfinishedPieces = Math.round(numberOrZero(product.unfinishedPieces));

    if (!product.noteType && product.note) {
      const lower = product.note.toLowerCase();
      const match = product.note.match(/(\d+)/);
      if (lower.includes("dopln")) {
        product.noteType = "doplneno";
        if (match) product.notePieces = Number(match[1]);
      } else if (lower.includes("rozprac") || lower.includes("zby")) {
        product.noteType = "rozpracovana";
        if (match) product.notePieces = Number(match[1]);
      }
    }
  }

  function openCalculator(input, onApply) {
    activeCalculator = { input, onApply };
    calculatorJustEvaluated = false;
    input.blur();
    els.calcExpression.value = input.value ? String(input.value) : "";
    els.calcApply.hidden = false;
    els.calcSheet.hidden = false;
    updateCalculatorResult();
  }

  function openStandaloneCalculator() {
    activeCalculator = null;
    calculatorJustEvaluated = false;
    els.calcExpression.value = "";
    els.calcApply.hidden = true;
    els.calcSheet.hidden = false;
    updateCalculatorResult();
  }

  function closeCalculator() {
    els.calcSheet.hidden = true;
    activeCalculator = null;
    calculatorJustEvaluated = false;
  }

  function enterCalculatorKey(key) {
    const expression = els.calcExpression.value;
    const isOperator = ["+", "-", "*", "/"].includes(key);

    if (calculatorJustEvaluated && !isOperator) {
      els.calcExpression.value = key === "." ? "0." : key;
      calculatorJustEvaluated = false;
      updateCalculatorResult();
      return;
    }

    calculatorJustEvaluated = false;
    if (isOperator) {
      if (!expression && key !== "-") return;
      if (/[+\-*/.]$/.test(expression)) {
        els.calcExpression.value = expression.slice(0, -1) + key;
      } else {
        els.calcExpression.value += key;
      }
    } else if (key === ".") {
      const currentNumber = expression.split(/[+\-*/]/).pop();
      if (currentNumber.includes(".")) return;
      els.calcExpression.value += currentNumber ? "." : "0.";
    } else {
      els.calcExpression.value += key;
    }
    updateCalculatorResult();
  }

  function commitCalculatorResult() {
    const value = evaluateCalculator(els.calcExpression.value);
    if (value === null) {
      els.calcResult.textContent = "Neplatný výpočet";
      vibrateCalculator([35, 35, 35]);
      return;
    }
    els.calcExpression.value = formatCalculatorValue(value);
    calculatorJustEvaluated = true;
    updateCalculatorResult();
    vibrateCalculator(28);
  }

  function formatCalculatorValue(value) {
    return String(Math.round(value * 10000) / 10000);
  }

  function vibrateCalculator(pattern = 14) {
    if (!els.calcVibration.checked || !navigator.vibrate || !pattern) return;
    navigator.vibrate(pattern);
  }

  function updateCalculatorResult() {
    const value = evaluateCalculator(els.calcExpression.value);
    if (value === null) {
      els.calcResult.textContent = "Neplatný výpočet";
      return;
    }
    els.calcResult.textContent = `${Math.round(value)} ks`;
  }

  function applyCalculator() {
    if (!activeCalculator) return;
    const value = evaluateCalculator(els.calcExpression.value);
    if (value === null) {
      els.calcResult.textContent = "Neplatný výpočet";
      return;
    }
    const pieces = Math.max(0, Math.round(value));
    activeCalculator.input.value = String(pieces);
    activeCalculator.onApply(pieces);
    closeCalculator();
  }

  function evaluateCalculator(expression) {
    const normalized = expression
      .replace(/,/g, ".")
      .replace(/[xX×]/g, "*")
      .replace(/÷/g, "/")
      .trim();
    if (!normalized) return 0;
    if (!/^[\d+\-*/.\s]+$/.test(normalized)) return null;
    try {
      const value = Function(`"use strict"; return (${normalized})`)();
      return Number.isFinite(value) ? value : null;
    } catch {
      return null;
    }
  }

  function applyQuickProducts(replace) {
    const parsed = parseProductText(els.quickProducts.value);
    if (!parsed.products.length) {
      renderWarnings(["Z rychlého vložení nešel přečíst žádný řádek s počtem kusů."]);
      return;
    }
    state.products = replace ? parsed.products : state.products.concat(parsed.products);
    els.quickProducts.value = "";
    render();
    if (parsed.skipped.length) {
      renderWarnings(parsed.skipped.map((line) => `Přeskočeno: ${line}`));
    }
  }

  function parseProductText(text) {
    const products = [];
    const skipped = [];
    text.split(/\r?\n/).forEach((rawLine) => {
      const line = rawLine.trim();
      if (!line) return;
      const match = line.match(/^(.+?)[\s:;,\-]+(\d+(?:[,.]\d+)?)\s*(?:ks|kusu|kusy)?$/i);
      if (!match) {
        skipped.push(line);
        return;
      }
      products.push({
        id: uid(),
        name: match[1].trim(),
        pieces: Math.round(Number(match[2].replace(",", "."))),
        noteType: "",
        notePieces: 0,
        note: "",
        color: ""
      });
    });
    return { products: products.filter((product) => product.pieces > 0), skipped };
  }

  function updatePlannerBoxButtons() {
    els.productionPlanner.querySelectorAll("[data-box-size]").forEach((button) => {
      button.classList.toggle("is-active", Number(button.dataset.boxSize) === plannerBoxSize);
    });
  }

  function updatePlannerRows() {
    els.plannerRows.querySelectorAll("[data-plan-product]").forEach(updatePlannerRow);
  }

  function updatePlannerRow(row) {
    const enabled = row.querySelector("[data-plan-enabled]").checked;
    const count = Math.max(0, Math.round(numberOrZero(row.dataset.boxCount)));
    row.dataset.boxCount = String(count);
    row.classList.toggle("is-disabled", !enabled);
    row.querySelectorAll("[data-plan-step], [data-plan-remainder]").forEach((control) => {
      control.disabled = !enabled;
    });
    const label = row.querySelector("[data-plan-boxes]");
    label.textContent = `${count} ${formatBoxWord(count)}`;
    const inherited = clampNumber(row.querySelector("[data-plan-remainder]").value, 0, plannerBoxSize - 1);
    row.querySelector("[data-plan-to-finish]").textContent = `Do celé bedny doplnit: ${plannerBoxSize - inherited} ks`;
  }

  function clampPlannerRemainders() {
    els.plannerRows.querySelectorAll("[data-plan-remainder]").forEach((input) => {
      input.value = String(clampNumber(input.value, 0, plannerBoxSize - 1));
    });
  }

  function updateProductionPlanner(resetVariant = false) {
    updatePlannerRows();
    const capacity = cleanPeople().reduce((acc, person) => acc + effectivePersonPieces(person), 0);
    const stock = readPlannerStock();
    productionPlanVariants = buildProductionPlanVariants(capacity, stock, plannerBoxSize);
    if (resetVariant) plannerVariant = 0;
    plannerVariant = productionPlanVariants.length ? plannerVariant % productionPlanVariants.length : 0;
    latestProductionPlan = productionPlanVariants[plannerVariant] || [];
    if (completedProductionPlan && completedProductionPlan.source === plannerSourceSignature()) {
      latestProductionPlan = completedProductionPlan.plan;
    } else {
      completedProductionPlan = null;
    }
    const total = latestProductionPlan.reduce((acc, item) => acc + item.pieces, 0);
    els.plannerTotal.textContent = `${total} ks`;
    els.plannerTarget.textContent = `${capacity} ks`;
    els.plannerVariantInfo.textContent = productionPlanVariants.length
      ? `${plannerVariant + 1} / ${productionPlanVariants.length}`
      : "0 / 0";
    els.nextProductionPlanVariant.disabled = productionPlanVariants.length <= 1;
    renderProductionPlanPreview(capacity, stock);
    updatePlannerCompletion(capacity);
  }

  function plannerSourceSignature() {
    return JSON.stringify({
      people: cleanPeople().map((person) => ({ id: person.id, target: effectivePersonPieces(person), product: person.fixedProduct, keeper: person.keeper })),
      stock: readPlannerStock(),
      boxSize: plannerBoxSize,
      completionLimit: Number(state.settings.boxCompletionLimit)
    });
  }

  function completionReceiver(productName, people = cleanPeople()) {
    return people
      .filter((person) => !person.fixedProduct || normalizeProductName(person.fixedProduct) === normalizeProductName(productName))
      .sort((a, b) => Number(b.keeper) - Number(a.keeper))[0];
  }

  function updatePlannerCompletion(capacity) {
    plannerCompletionOffer = null;
    if (capacity > 0 && !completedProductionPlan) {
      const stock = readPlannerStock();
      plannerCompletionOffer = latestProductionPlan
        .map((item) => {
          const inherited = stock.find((entry) => entry.name === item.name)?.remainder || 0;
          return { name: item.name, extra: plannerBoxSize - ((item.pieces + inherited) % plannerBoxSize) };
        })
        .filter((item) => item.extra >= 1 && item.extra <= Number(state.settings.boxCompletionLimit))
        .sort((a, b) => a.extra - b.extra)[0] || null;
    }
    const offer = plannerCompletionOffer;
    els.plannerCompletion.hidden = !offer;
    if (!offer) return;
    const total = sum(latestProductionPlan, "pieces") + offer.extra;
    const receiver = completionReceiver(offer.name);
    els.plannerCompletionTitle.textContent = `${offer.name}: do celé bedny chybí ${offer.extra} ks`;
    els.plannerCompletionDetail.textContent = `Plán ${total} ks, tedy +${total - capacity} ks nad cíl party. `
      + (receiver ? `Kusy navíc: ${receiver.name}.` : "Chybí člověk, který může tento výrobek převzít.");
    els.completePlannerBox.textContent = `Dokončit bednu (+${offer.extra} ks)`;
    els.completePlannerBox.disabled = !receiver;
  }

  function buildProductionPlanVariants(capacity, stock, boxSize) {
    const recommended = buildProductionPlan(capacity, stock, boxSize);
    if (recommended.length <= 1) return recommended.length ? [recommended] : [];

    const variants = [];
    const seen = new Set();
    permute(recommended.map((item) => item.name)).forEach((names) => {
      const variant = recommended.map((item, index) => ({
        name: names[index],
        pieces: item.pieces
      }));
      // Close the non-final products at physical box boundaries; carry their unused work forward.
      for (let index = 0; index < variant.length - 1; index += 1) {
        const item = variant[index];
        const inherited = stock.find((entry) => entry.name === item.name)?.remainder || 0;
        const carry = Math.min(item.pieces, (item.pieces + inherited) % boxSize);
        item.pieces -= carry;
        variant[variant.length - 1].pieces += carry;
      }
      const signature = variant
        .map((item) => `${item.name}:${item.pieces}`)
        .sort((a, b) => a.localeCompare(b, "cs"))
        .join("|");
      if (seen.has(signature)) return;
      seen.add(signature);
      variants.push(variant.filter((item) => item.pieces > 0));
    });
    return variants;
  }

  function permute(items) {
    if (items.length <= 1) return [items.slice()];
    const result = [];
    items.forEach((item, index) => {
      const rest = items.slice(0, index).concat(items.slice(index + 1));
      permute(rest).forEach((tail) => result.push([item, ...tail]));
    });
    return result;
  }

  function readPlannerStock() {
    return Array.from(els.plannerRows.querySelectorAll("[data-plan-product]"))
      .filter((row) => row.querySelector("[data-plan-enabled]").checked)
      .map((row) => ({
        name: row.dataset.planProduct,
        boxes: Math.max(0, Math.round(numberOrZero(row.dataset.boxCount))),
        remainder: clampNumber(row.querySelector("[data-plan-remainder]").value, 0, plannerBoxSize - 1)
      }));
  }

  function buildProductionPlan(capacity, stock, boxSize) {
    if (capacity <= 0 || !stock.length) return [];

    const names = stock.map((item) => item.name);
    const starter = stock.find((item) => item.remainder > 0)?.name || chooseLowestStockProduct(stock)?.name || names[0];
    const finalProduct = chooseFinalProduct(stock, starter) || names.find((name) => name !== starter) || starter;
    const middle = names.find((name) => name !== starter && name !== finalProduct) || names.find((name) => name !== starter) || starter;

    const firstPieces = chooseLargePlanBlock(capacity, boxSize);
    let remaining = Math.max(0, capacity - firstPieces);
    let secondPieces = remaining > 0 ? Math.min(firstPieces, remaining) : 0;
    remaining = Math.max(0, remaining - secondPieces);

    while (remaining > boxSize && secondPieces + boxSize <= capacity - firstPieces) {
      secondPieces += boxSize;
      remaining -= boxSize;
    }

    const result = [
      { name: starter, pieces: firstPieces },
      { name: middle, pieces: secondPieces },
      { name: finalProduct, pieces: remaining }
    ].filter((item) => item.pieces > 0);

    return mergePlanProducts(result);
  }

  function chooseLargePlanBlock(capacity, boxSize) {
    const count = Math.max(1, Math.floor(capacity / boxSize / 2));
    return Math.min(capacity, count * boxSize);
  }

  function chooseLowestStockProduct(stock) {
    return stock
      .map((item, index) => ({ item, index }))
      .sort((a, b) => a.item.boxes - b.item.boxes || a.index - b.index)[0]?.item;
  }

  function chooseFinalProduct(stock, starter) {
    const candidates = stock.filter((item) => item.name !== starter);
    if (!candidates.length) return null;
    const withBoxes = candidates.filter((item) => item.boxes > 0);
    if (!withBoxes.length) return candidates[candidates.length - 1].name;
    return withBoxes
      .map((item, index) => ({ item, index }))
      .sort((a, b) => b.item.boxes - a.item.boxes || a.index - b.index)[0].item.name;
  }

  function mergePlanProducts(products) {
    const merged = [];
    products.forEach((product) => {
      const existing = merged.find((item) => item.name === product.name);
      if (existing) {
        existing.pieces += product.pieces;
      } else {
        merged.push({ ...product });
      }
    });
    return merged;
  }

  function renderProductionPlanPreview(capacity, stock) {
    els.plannerPreview.replaceChildren();

    if (capacity <= 0) {
      const note = document.createElement("div");
      note.className = "planner-note";
      note.textContent = "Nejdřív vyplň partu, aby byla známá kapacita směny.";
      els.plannerPreview.append(note);
      els.applyProductionPlan.disabled = true;
      return;
    }

    if (!stock.length) {
      const note = document.createElement("div");
      note.className = "planner-note";
      note.textContent = "Vyber alespoň jeden výrobek pro dnešní plán.";
      els.plannerPreview.append(note);
      els.applyProductionPlan.disabled = true;
      return;
    }

    latestProductionPlan.forEach((item) => {
      const row = document.createElement("div");
      row.className = "planner-preview-row";
      const name = document.createElement("strong");
      name.textContent = item.name;
      const info = document.createElement("span");
      const stockItem = stock.find((stockRow) => stockRow.name === item.name);
      const split = splitShiftProduction(item.pieces, stockItem?.remainder || 0, plannerBoxSize);
      const details = [`Vyrobit dnes; odevzdat ${split.deliveredBoxes} ${formatBoxWord(split.deliveredBoxes)}`];
      if (split.completed > 0) details.push(`z toho doplnit ${split.completed} ks`);
      if (split.unfinished > 0) details.push(`rozpracováno ${split.unfinished} ks`);
      info.textContent = details.join("; ");
      const pieces = document.createElement("strong");
      pieces.textContent = `${item.pieces} ks`;
      row.append(name, info, pieces);
      els.plannerPreview.append(row);
    });

    els.applyProductionPlan.disabled = !latestProductionPlan.length;
  }

  function applyProductionPlan() {
    if (!latestProductionPlan.length) return;
    const stock = readPlannerStock();
    state.products = latestProductionPlan.map((item) => {
      const stockItem = stock.find((stockRow) => stockRow.name === item.name);
      const product = {
        id: uid(),
        name: item.name,
        pieces: item.pieces,
        startingPieces: stockItem?.remainder || 0,
        boxSize: plannerBoxSize,
        note: ""
      };
      fillProductInfoPieces(product);
      return product;
    });
    delete state.settings.boxCompletion;
    if (completedProductionPlan) {
      const offer = completedProductionPlan.offer;
      const product = state.products.find((item) => item.name === offer.name);
      const receiver = completionReceiver(offer.name);
      if (product && receiver) {
        state.settings.boxCompletion = {
          productId: product.id,
          receiverId: receiver.id,
          pieces: offer.extra,
          signature: completionInputSignature()
        };
      }
    }
    render();
  }

  function completionInputSignature() {
    return JSON.stringify({
      people: state.people.map(({ id, fixedPieces, fixedProduct, rate, hours, keeper }) => ({ id, fixedPieces, fixedProduct, rate, hours, keeper })),
      products: state.products.map(({ id, name, pieces, startingPieces, boxSize }) => ({ id, name, pieces, startingPieces, boxSize })),
      color: state.settings.productionColor
    });
  }

  function acceptedBoxCompletion(people, products) {
    const completion = state.settings.boxCompletion;
    if (!completion || completion.signature !== completionInputSignature()) return null;
    if (!Number.isInteger(completion.pieces) || completion.pieces < 1 || completion.pieces > 30) return null;
    const product = products.find((item) => item.id === completion.productId && item.pieces >= completion.pieces);
    const receiver = people.find((person) => person.id === completion.receiverId);
    if (!product || !receiver || (receiver.fixedProduct && normalizeProductName(receiver.fixedProduct) !== normalizeProductName(product.name))) return null;
    return { ...completion, product, receiver };
  }

  function formatBoxWord(count) {
    if (count === 1) return "bedna";
    if (count >= 2 && count <= 4) return "bedny";
    return "beden";
  }

  function calculateNextPlan() {
    const signature = getCalculationSignature();
    if (signature === lastCalculationSignature) {
      calculationVariant = (calculationVariant + 1) % CALC_VARIANT_COUNT;
    } else {
      lastCalculationSignature = signature;
      calculationVariant = 0;
    }
    return calculatePlan(calculationVariant);
  }

  function getCalculationSignature() {
    const completion = acceptedBoxCompletion(cleanPeople(), cleanProducts());
    return JSON.stringify({
      people: state.people.map((person) => ({
        id: person.id,
        name: person.name,
        rate: person.rate,
        hours: person.hours,
        fixedPieces: person.fixedPieces,
        fixedProduct: person.fixedProduct,
        keeper: person.keeper
      })),
      products: state.products.map((product) => ({
        id: product.id,
        name: product.name,
        pieces: product.pieces
      })),
      settings: {
        minRecordHours: state.settings.minRecordHours,
        completion: completion ? {
          pieces: completion.pieces,
          productId: completion.productId,
          receiverId: completion.receiverId
        } : null
      }
    });
  }

  function hasCurrentCalculation() {
    const saved = state.calculation;
    if (!saved || saved.version !== 1 || saved.signature !== getCalculationSignature()) return false;
    const plan = saved.plan;
    if (!plan || !Number.isInteger(plan.variant) || plan.variant < 1 || plan.variant > CALC_VARIANT_COUNT) return false;
    if (!Array.isArray(plan.warnings) || !plan.warnings.every((warning) => typeof warning === "string")) return false;
    if (!Array.isArray(plan.assignments)) return false;
    return plan.assignments.every((assignment) => {
      if (!assignment || !assignment.person || typeof assignment.person.name !== "string") return false;
      if (![assignment.assigned, assignment.target, assignment.person.hours, assignment.person.rate, assignment.person.capacity]
        .every((value) => Number.isFinite(value) && value >= 0)) return false;
      return Array.isArray(assignment.lines) && assignment.lines.every((line) =>
        line && typeof line.product === "string" && Number.isInteger(line.pieces) && line.pieces >= 0
      ) && Array.isArray(assignment.lineHours) && assignment.lineHours.length === assignment.lines.length &&
        assignment.lineHours.every((hours) => Number.isFinite(hours) && hours >= 0);
    });
  }

  function storeCalculation(plan) {
    // Keep the chosen allocation and its hours, not just inputs for a future recalculation.
    const snapshot = JSON.parse(JSON.stringify(plan));
    snapshot.assignments.forEach((assignment) => {
      assignment.lineHours = allocateLineHours(assignment);
    });
    state.calculation = { version: 1, signature: getCalculationSignature(), plan: snapshot };
    restoreCalculation();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function restoreCalculation() {
    if (!hasCurrentCalculation()) return false;
    lastCalculationSignature = state.calculation.signature;
    calculationVariant = state.calculation.plan.variant - 1;
    renderResults(state.calculation.plan);
    setCalculateVariantHint(state.calculation.plan.assignments.length > 0);
    return true;
  }

  function calculatePlan(variant = 0) {
    const variantIndex = Math.abs(Math.round(variant)) % CALC_VARIANT_COUNT;
    const people = cleanPeople();
    const products = cleanProducts();
    const totalPieces = sum(products, "pieces");
    const totalCapacity = people.reduce((acc, person) => acc + person.capacity, 0);
    const warnings = [];

    if (!people.length) warnings.push("Chybí parta s vyplněnými hodinami a výkonem.");
    if (!products.length) warnings.push("Chybí výroba s počtem kusů.");
    if (!totalCapacity) warnings.push("Cíl party je nula.");
    if (warnings.length) return { people, products, totalPieces, totalCapacity, warnings, assignments: [], variant: variantIndex + 1 };

    const keepers = people.filter((person) => person.keeper);
    const fallbackKeepers = keepers.length ? keepers : [people[0]];
    const completion = acceptedBoxCompletion(people, products);
    const targets = calculateTargets(people, totalPieces - (completion ? completion.pieces : 0), warnings);
    const assignments = people.map((person) => ({
      person,
      lines: [],
      assigned: 0,
      target: targets.get(person.id) || 0
    }));

    const inventory = orderProductsForVariant(products, variantIndex)
      .map((product) => ({
        ...product,
        remaining: product.pieces - (completion && product.id === completion.productId ? completion.pieces : 0)
      }));

    applyFixedProducts(assignments, inventory, warnings);

    const regularAssignments = orderAssignmentsForVariant(
      assignments.filter((item) => !item.person.keeper),
      variantIndex
    );

    const keeperAssignments = orderAssignmentsForVariant(
      assignments.filter((item) => item.person.keeper),
      variantIndex + 2
    );

    regularAssignments.forEach((assignment) => {
      fillPractical(assignment, inventory, PREFERRED_PRODUCT_ROWS, minPiecesFor(assignment.person), variantIndex);
    });

    keeperAssignments.forEach((assignment) => {
      fillPractical(assignment, inventory, products.length + 2, 1, variantIndex + 1);
    });

    distributeLeftovers(assignments, fallbackKeepers, inventory, warnings, variantIndex);
    mergeTinyLines(assignments);
    improveLineMixBySwaps(assignments);
    moveTinyLinesIntoMatchingProducts(assignments);
    improveLineMixBySwaps(assignments);
    cleanupAssignmentLines(assignments);
    applyAlternativeVariant(assignments, variantIndex);
    cleanupAssignmentLines(assignments);

    if (completion) {
      const receiver = assignments.find((assignment) => assignment.person.id === completion.receiverId);
      addLine(receiver, { name: completion.product.name, remaining: completion.pieces }, completion.pieces);
      warnings.push(`Dokončení bedny ${completion.product.name}: ${completion.receiver.name} má +${completion.pieces} ks nad původní cíl.`);
    }

    assignments.forEach((assignment) => {
      assignment.lines.sort((a, b) => b.pieces - a.pieces || a.product.localeCompare(b.product, "cs"));
    });

    const assignedTotal = assignments.reduce((acc, item) => acc + item.assigned, 0);
    if (assignedTotal !== totalPieces) {
      warnings.push(`Kontrola nesedi: rozdeleno ${assignedTotal} ks z ${totalPieces} ks.`);
    }

    assignments.forEach((assignment) => {
      const minPieces = minPiecesFor(assignment.person);
      if (assignment.assigned > assignment.person.capacity) {
        warnings.push(`${assignment.person.name} je nad normu: ${assignment.assigned} ks / kapacita ${assignment.person.capacity} ks.`);
      }
      const completionExtra = completion && assignment.person.id === completion.receiverId ? completion.pieces : 0;
      if (isFixedAssignment(assignment) && assignment.assigned !== assignment.target + completionExtra) {
        warnings.push(`${assignment.person.name} má pevně ${assignment.target} ks, ale vyšlo ${assignment.assigned} ks.`);
      }
      const small = assignment.lines.filter((line) => line.pieces > 0 && line.pieces < minPieces);
      if (small.length) {
        warnings.push(`${assignment.person.name} má malý řádek pod nastaveným minimem: ${small.map((line) => `${line.product} ${line.pieces} ks`).join(", ")}.`);
      }
    });

    return { people, products, totalPieces, totalCapacity, warnings, assignments, variant: variantIndex + 1 };
  }

  function saveDailyRecord() {
    if (!confirm("Opravdu chcete uložit tento výkon?")) return;
    if (!hasCurrentCalculation()) storeCalculation(calculatePlan(0));
    const plan = state.calculation.plan;
    const records = loadRecords();
    const now = new Date();
    const products = cleanProducts();
    const people = cleanPeople();
    const totalPieces = sum(products, "pieces");
    records.unshift({
      id: uid(),
      savedAt: now.toISOString(),
      title: formatRecordTitle(now),
      summary: `${totalPieces} ks | ${people.length} členů party | ${plan.assignments.length ? getVariantLabel(plan.variant) : "bez výsledku"}`,
      state: cloneCurrentState()
    });
    try {
      localStorage.setItem(RECORDS_KEY, JSON.stringify(records.slice(0, 80)));
      renderWarnings([...plan.warnings, `Uloženo: ${formatRecordTitle(now)}${plan.assignments.length ? `, varianta ${plan.variant}` : ", pouze zadání bez výsledku"}.`]);
    } catch {
      renderWarnings([...plan.warnings, "Záznam se nepodařilo uložit. Úložiště může být plné."]);
    }
  }

  function openRecordLoader() {
    const records = loadRecords();
    els.recordSheet.hidden = false;
    renderRecordList(records);
  }

  function closeRecordLoader() {
    els.recordSheet.hidden = true;
  }

  function updateInstallButtons() {
    if (isStandaloneApp()) {
      els.installPanel.hidden = true;
      els.installApp.hidden = true;
      return;
    }
    els.installPanel.hidden = false;
    els.installAndroid.disabled = false;
  }

  function isStandaloneApp() {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  }

  function openInstallGuide(platform) {
    const guide = getInstallGuide(platform);
    els.installGuideTitle.textContent = guide.title;
    els.installGuideContent.replaceChildren(...guide.nodes);
    els.installSheet.hidden = false;
  }

  function closeInstallGuide() {
    els.installSheet.hidden = true;
  }

  function getInstallGuide(platform) {
    if (platform === "installed") {
      return buildInstallGuide(
        "Aplikace už je přidaná",
        [
          "Výkoňák už běží jako aplikace z plochy.",
          "Když ho chceš otevřít příště, použij ikonu na ploše telefonu."
        ]
      );
    }
    if (platform === "ios") {
      return buildInstallGuide(
        "Přidat na iPhone",
        [
          "Otevři Výkoňák v Safari.",
          "Klepni na tři tečky v Safari.",
          "Hledej Přidat na plochu nebo Add to Home Screen.",
          "Pokud tam tato volba není, klepni nejdřív na Sdílet a potom Přidat na plochu.",
          "Potvrď Přidat."
        ],
        "Na iPhonu to nejde spustit jedním tlačítkem z webu. Apple to dovoluje jen ručně přes nabídku Safari."
      );
    }
    return buildInstallGuide(
      "Přidat na Android",
      [
        "Otevři Výkoňák v Chrome.",
        "Klepni na tři tečky vpravo nahoře.",
        "Zvol Přidat na plochu nebo Nainstalovat aplikaci.",
        "Potvrď přidání."
      ],
      "Když Chrome instalaci dovolí, tlačítko Android ji otevře rovnou. Když ne, použij tento postup."
    );
  }

  function buildInstallGuide(title, steps, note = "") {
    const list = document.createElement("ol");
    steps.forEach((step) => {
      const item = document.createElement("li");
      item.textContent = step;
      list.append(item);
    });
    const nodes = [list];
    if (note) {
      const paragraph = document.createElement("p");
      paragraph.textContent = note;
      nodes.push(paragraph);
    }
    return { title, nodes };
  }

  function openHelp() {
    els.helpSheet.hidden = false;
  }

  function closeHelp() {
    els.helpSheet.hidden = true;
  }

  function renderRecordList(records) {
    if (!records.length) {
      const empty = document.createElement("div");
      empty.className = "record-empty";
      empty.textContent = "Zatím není uložený žádný záznam.";
      els.recordList.replaceChildren(empty);
      return;
    }

    els.recordList.replaceChildren(...records.map((record) => {
      const row = document.createElement("div");
      row.className = "record-item";
      const text = document.createElement("span");
      const title = document.createElement("strong");
      title.textContent = record.title || formatRecordTitle(new Date(record.savedAt));
      const summary = document.createElement("span");
      summary.textContent = record.summary || "Uložený výpočet";
      text.append(title, summary);
      const colors = getRecordColors(record);
      if (colors.length) {
        const chips = document.createElement("span");
        chips.className = "record-color-strip";
        colors.forEach((color) => {
          const chip = document.createElement("span");
          chip.className = `record-color-chip product-color-${color}`;
          chips.append(chip);
        });
        text.append(chips);
      }
      const actions = document.createElement("span");
      actions.className = "record-item-actions";
      const load = document.createElement("button");
      load.className = "text-button";
      load.type = "button";
      load.textContent = "Načíst";
      load.addEventListener("click", () => loadDailyRecord(record));
      const remove = document.createElement("button");
      remove.className = "icon-button remove-row";
      remove.type = "button";
      remove.setAttribute("aria-label", "Smazat záznam");
      remove.textContent = "x";
      remove.addEventListener("click", () => deleteDailyRecord(record.id));
      actions.append(load, remove);
      row.append(text, actions);
      return row;
    }));
  }

  function loadDailyRecord(record) {
    const savedState = JSON.parse(JSON.stringify(record.state || {}));
    state.people = savedState.people || [];
    state.products = savedState.products || [];
    state.calculation = savedState.calculation;
    const recordSettings = savedState.settings || {};
    const recordColor = "productionColor" in recordSettings
      ? recordSettings.productionColor
      : inferProductionColor(record.state && record.state.products);
    state.settings = {
      ...recordSettings,
      productionColor: recordColor || ""
    };
    normalizeState(state);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    closeRecordLoader();
    render();
    const restored = restoreCalculation();
    if (!restored) storeCalculation(calculatePlan(0));
    const plan = state.calculation.plan;
    const message = restored
      ? `Načteno: ${record.title || "uložený záznam"}${plan.assignments.length ? `, uložená varianta ${plan.variant}` : ""}.`
      : plan.assignments.length
        ? "Záznam neobsahuje platnou uloženou variantu. Nově spočítána varianta 1."
        : "Načtené zadání nelze spočítat. Zkontroluj údaje nahoře.";
    renderWarnings([...plan.warnings, message]);
  }

  function deleteDailyRecord(recordId) {
    if (!confirm("Chcete opravdu tento výsledek smazat?")) return;
    const records = loadRecords().filter((record) => record.id !== recordId);
    localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
    renderRecordList(records);
  }

  function cloneCurrentState() {
    return JSON.parse(JSON.stringify({
      people: state.people,
      products: state.products,
      settings: state.settings,
      calculation: state.calculation
    }));
  }

  function loadRecords() {
    try {
      const raw = localStorage.getItem(RECORDS_KEY);
      const records = raw ? JSON.parse(raw) : [];
      return Array.isArray(records) ? records : [];
    } catch {
      return [];
    }
  }

  function getRecordColors(record) {
    const color = record.state && record.state.settings && record.state.settings.productionColor;
    if (color) return [color];
    const inferred = inferProductionColor(record.state && record.state.products);
    if (inferred) return [inferred];
    return [];
  }

  function inferProductionColor(products) {
    if (!Array.isArray(products)) return "";
    const colored = products.find((product) => product.color);
    return colored ? colored.color : "";
  }

  function formatRecordTitle(date) {
    return new Intl.DateTimeFormat("cs-CZ", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }).format(date);
  }

  function calculateTargets(people, totalPieces, warnings) {
    const targets = new Map();
    const fixedPeople = people.filter((person) => person.fixedPieces > 0);
    const flexiblePeople = people.filter((person) => person.fixedPieces <= 0);
    const fixedTotal = fixedPeople.reduce((acc, person) => acc + person.fixedPieces, 0);

    fixedPeople.forEach((person) => {
      targets.set(person.id, person.fixedPieces);
      if (person.fixedPieces > person.capacity) {
        warnings.push(`${person.name} má pevně ${person.fixedPieces} ks, ale kapacita směny je jen ${person.capacity} ks.`);
      }
    });

    let remaining = totalPieces - fixedTotal;
    if (remaining < 0) {
      warnings.push(`Pevné kusy jsou dohromady ${fixedTotal} ks, ale výroba má jen ${totalPieces} ks.`);
      remaining = 0;
    }

    const flexibleCapacity = flexiblePeople.reduce((acc, person) => acc + person.capacity, 0);
    if (!flexiblePeople.length) {
      if (remaining > 0) {
        warnings.push(`Zbývá ${remaining} ks, ale všichni mají pevné kusy. Přidej člověka bez pevného čísla nebo uprav pevné kusy.`);
      }
      return targets;
    }

    if (remaining > flexibleCapacity) {
      warnings.push(`Výroba je nad normu party o ${remaining - flexibleCapacity} ks. Kusy se přesto rozdělí všechny.`);
    }

    if (!flexibleCapacity) {
      distributeTargetRemainder(targets, people, remaining);
      return targets;
    }

    flexiblePeople.forEach((person) => {
      targets.set(person.id, Math.round(remaining * (person.capacity / flexibleCapacity)));
    });

    adjustFlexibleTargets(targets, flexiblePeople, remaining);
    return targets;
  }

  function adjustFlexibleTargets(targets, flexiblePeople, expectedTotal) {
    let current = flexiblePeople.reduce((acc, person) => acc + (targets.get(person.id) || 0), 0);
    let diff = expectedTotal - current;
    const byRoom = flexiblePeople.slice().sort((a, b) => b.capacity - a.capacity);

    while (diff > 0) {
      const receiver = byRoom[0];
      if (!receiver) break;
      targets.set(receiver.id, (targets.get(receiver.id) || 0) + 1);
      diff -= 1;
    }

    while (diff < 0) {
      const donor = byRoom.find((person) => (targets.get(person.id) || 0) > 0);
      if (!donor) break;
      targets.set(donor.id, (targets.get(donor.id) || 0) - 1);
      diff += 1;
    }
  }

  function distributeTargetRemainder(targets, people, remaining) {
    if (remaining <= 0 || !people.length) return;
    const byCapacity = people.slice().sort((a, b) => b.capacity - a.capacity);
    for (let i = 0; i < remaining; i += 1) {
      const receiver = byCapacity[i % byCapacity.length];
      targets.set(receiver.id, (targets.get(receiver.id) || 0) + 1);
    }
  }

  function orderProductsForVariant(products, variant) {
    const indexed = products.map((product, index) => ({ ...product, orderIndex: index }));
    const mode = variant % 4;
    if (mode === 1) {
      indexed.sort((a, b) => a.pieces - b.pieces || a.orderIndex - b.orderIndex);
    } else if (mode === 2) {
      indexed.sort((a, b) => a.orderIndex - b.orderIndex);
    } else if (mode === 3) {
      indexed.sort((a, b) => a.name.localeCompare(b.name, "cs") || b.pieces - a.pieces);
    } else {
      indexed.sort((a, b) => b.pieces - a.pieces || a.orderIndex - b.orderIndex);
    }
    return rotate(indexed, Math.floor(variant / 4));
  }

  function orderAssignmentsForVariant(assignments, variant) {
    const indexed = assignments.map((assignment, index) => ({ assignment, index }));
    const mode = variant % 4;
    if (mode === 1) {
      indexed.sort((a, b) => a.assignment.target - b.assignment.target || a.index - b.index);
    } else if (mode === 2) {
      indexed.sort((a, b) => a.index - b.index);
    } else if (mode === 3) {
      indexed.sort((a, b) => a.assignment.person.name.localeCompare(b.assignment.person.name, "cs") || a.index - b.index);
    } else {
      indexed.sort((a, b) => b.assignment.target - a.assignment.target || a.index - b.index);
    }
    return rotate(indexed, Math.floor(variant / 4)).map((item) => item.assignment);
  }

  function rotate(items, shift) {
    if (!items.length) return items;
    const offset = Math.abs(shift) % items.length;
    return items.slice(offset).concat(items.slice(0, offset));
  }

  function applyFixedProducts(assignments, inventory, warnings) {
    assignments.forEach((assignment) => {
      const fixedPieces = Math.round(numberOrZero(assignment.person.fixedPieces));
      const fixedProduct = normalizeProductName(assignment.person.fixedProduct);
      if (fixedPieces <= 0 || !fixedProduct) return;

      const product = inventory.find((item) => normalizeProductName(item.name) === fixedProduct);
      if (!product) {
        warnings.push(`${assignment.person.name} má pevné kusy z výrobku ${assignment.person.fixedProduct}, ale taková výroba není zadaná.`);
        return;
      }

      const room = Math.max(0, assignment.target - assignment.assigned);
      const amount = Math.min(product.remaining, fixedPieces, room);
      if (amount > 0) addLine(assignment, product, amount);

      if (amount < fixedPieces) {
        warnings.push(`${assignment.person.name} má pevně ${fixedPieces} ks z ${assignment.person.fixedProduct}, ale dostupných je jen ${amount} ks.`);
      }
    });
  }

  function fillPractical(assignment, inventory, maxRows, minPieces, variant = 0) {
    let rowsLeft = maxRows;
    while (rowsLeft > 0 && assignment.assigned < assignment.target) {
      const need = assignment.target - assignment.assigned;
      const product = chooseBestProduct(inventory, need, minPieces, rowsLeft, variant + rowsLeft);
      if (!product) break;
      let amount = Math.min(product.remaining, need);
      const leftover = product.remaining - amount;
      if (leftover > 0 && leftover < minPieces && product.remaining <= need) {
        amount = product.remaining;
      }
      amount = Math.min(amount, need);
      addLine(assignment, product, amount);
      rowsLeft -= 1;
    }
  }

  function distributeLeftovers(assignments, keepers, inventory, warnings, variant = 0) {
    const keeperAssignments = keepers
      .map((keeper) => assignments.find((assignment) => assignment.person.id === keeper.id))
      .filter(Boolean);
    const flexibleKeeperAssignments = keeperAssignments.filter((assignment) => !isFixedAssignment(assignment));
    const fixedKeeperAssignments = keeperAssignments.filter(isFixedAssignment);
    const flexibleAssignments = assignments.filter((assignment) => !isFixedAssignment(assignment));
    const fallbackAssignments = flexibleKeeperAssignments.length
      ? flexibleKeeperAssignments
      : (flexibleAssignments.length ? flexibleAssignments : fixedKeeperAssignments);

    inventory.forEach((product) => {
      while (product.remaining > 0) {
        const receiver = orderReceiversForVariant(
          assignments.filter((assignment) => assignment.assigned < assignment.target),
          variant,
          "room"
        )[0];
        if (!receiver) break;
        const room = receiver.target - receiver.assigned;
        addLine(receiver, product, Math.min(product.remaining, room));
      }

      if (product.remaining > 0) {
        const receiver = orderReceiversForVariant(fallbackAssignments, variant, "load")[0];
        if (!receiver) {
          warnings.push(`Nerozděleno zůstává ${product.remaining} ks ${product.name}.`);
          return;
        }
        if (isFixedAssignment(receiver)) {
          warnings.push(`Nerozděleno zůstává ${product.remaining} ks ${product.name}, protože zbyli jen lidé s pevným číslem.`);
          return;
        }
        addLine(receiver, product, product.remaining);
      }
    });
  }

  function orderReceiversForVariant(assignments, variant, mode) {
    const ordered = assignments.slice();
    if (mode === "room") {
      ordered.sort((a, b) => (b.target - b.assigned) - (a.target - a.assigned) || loadRatio(a) - loadRatio(b));
    } else {
      ordered.sort((a, b) => loadRatio(a) - loadRatio(b) || (b.target - b.assigned) - (a.target - a.assigned));
    }
    return rotate(ordered, variant % Math.max(1, Math.min(ordered.length, 3)));
  }

  function mergeTinyLines(assignments) {
    let changed = true;
    while (changed) {
      changed = false;
      for (const assignment of assignments) {
        if (isFixedAssignment(assignment)) continue;
        const minPieces = minPiecesFor(assignment.person);
        const tiny = assignment.lines.find((line) => line.pieces > 0 && line.pieces < minPieces);
        if (!tiny) continue;

        const receiver = findTinyLineReceiver(assignments, assignment, tiny.product);
        if (!receiver) continue;

        moveLinePieces(assignment, receiver, tiny);
        changed = true;
        break;
      }
    }
  }

  function findTinyLineReceiver(assignments, source, productName) {
    const movedPieces = source.lines.find((line) => line.product === productName)?.pieces || 0;
    const withSameProduct = assignments
      .filter((assignment) => assignment !== source && canReceiveMovedLine(assignment, movedPieces) && assignment.lines.some((line) => line.product === productName))
      .sort((a, b) => {
        const aRoom = a.target - a.assigned;
        const bRoom = b.target - b.assigned;
        return bRoom - aRoom || loadRatio(a) - loadRatio(b);
      });
    return withSameProduct[0];
  }

  function moveLinePieces(source, receiver, line) {
    if (isFixedAssignment(source) || !canReceiveMovedLine(receiver, line.pieces)) return;
    const existing = receiver.lines.find((item) => item.product === line.product);
    if (existing) {
      existing.pieces += line.pieces;
    } else {
      receiver.lines.push({ product: line.product, pieces: line.pieces });
    }
    receiver.assigned += line.pieces;
    source.assigned -= line.pieces;
    source.lines = source.lines.filter((item) => item !== line);
  }

  function moveTinyLinesIntoMatchingProducts(assignments) {
    for (const source of assignments) {
      const minPieces = minPiecesFor(source.person);
      const tiny = source.lines.find((line) => line.pieces > 0 && line.pieces < minPieces);
      if (!tiny) continue;

      const sourceOther = source.lines
        .filter((line) => line.product !== tiny.product && line.pieces >= tiny.pieces)
        .sort((a, b) => b.pieces - a.pieces)[0];
      if (!sourceOther) continue;

      const target = assignments.find((assignment) =>
        assignment !== source
        && !hasFixedProductLock(assignment)
        && assignment.lines.some((line) =>
          line.product === sourceOther.product
          && line.pieces > tiny.pieces
          && line.pieces - tiny.pieces >= minPiecesFor(assignment.person)
        )
        && !assignment.lines.some((line) => line.product === tiny.product)
      );
      if (!target) continue;

      swapEqualPieces(source, tiny.product, target, sourceOther.product, tiny.pieces);
      return;
    }
  }

  function applyAlternativeVariant(assignments, variantIndex) {
    if (variantIndex <= 0) return;

    const originalSignature = assignmentLineSignature(assignments);
    const candidates = [];

    assignments.forEach((source, sourceIndex) => {
      if (hasFixedProductLock(source)) return;
      source.lines.forEach((sourceLine) => {
        if (sourceLine.pieces < minPiecesFor(source.person)) return;

        assignments.forEach((target, targetIndex) => {
          if (target === source) return;
          if (hasFixedProductLock(target)) return;

          target.lines.forEach((targetLine) => {
            if (targetLine.product === sourceLine.product) return;
            if (targetLine.pieces < sourceLine.pieces) return;
            if (!isCleanRemainder(targetLine.pieces - sourceLine.pieces, target.person)) return;

            const before = variantQuality(assignments);
            swapEqualPieces(source, sourceLine.product, target, targetLine.product, sourceLine.pieces);
            cleanupAssignmentLines(assignments);
            const signature = assignmentLineSignature(assignments);
            const after = variantQuality(assignments);
            const valid = signature !== originalSignature
              && after.tinyLines === 0
              && after.overRowLimit === 0
              && after.score <= before.score + 1;

            if (valid) {
              candidates.push({
                signature,
                sourceIndex,
                targetIndex,
                pieces: sourceLine.pieces,
                score: after.score
              });
            }

            swapEqualPieces(source, targetLine.product, target, sourceLine.product, sourceLine.pieces);
            cleanupAssignmentLines(assignments);
          });
        });
      });
    });

    const unique = [];
    const seen = new Set();
    candidates
      .sort((a, b) => a.score - b.score || a.pieces - b.pieces || a.sourceIndex - b.sourceIndex || a.targetIndex - b.targetIndex)
      .forEach((candidate) => {
        if (seen.has(candidate.signature)) return;
        seen.add(candidate.signature);
        unique.push(candidate);
      });

    const selected = unique[variantIndex - 1];
    if (!selected) return;
    applySignature(assignments, selected.signature);
  }

  function isCleanRemainder(pieces, person) {
    return pieces === 0 || pieces >= minPiecesFor(person);
  }

  function variantQuality(assignments) {
    let tinyLines = 0;
    let overRowLimit = 0;
    assignments.forEach((assignment) => {
      const minPieces = minPiecesFor(assignment.person);
      const rowLimit = PREFERRED_PRODUCT_ROWS;
      tinyLines += assignment.lines.filter((line) => line.pieces > 0 && line.pieces < minPieces).length;
      overRowLimit += Math.max(0, assignment.lines.length - rowLimit);
    });
    return { tinyLines, overRowLimit, score: tinyLines * 10 + overRowLimit * 3 };
  }

  function applySignature(assignments, signature) {
    signature.split("|").forEach((assignmentPart, index) => {
      const assignment = assignments[index];
      if (!assignment) return;
      assignment.lines = assignmentPart
        ? assignmentPart.split(",").map((part) => {
          const separator = part.lastIndexOf(":");
          return {
            product: part.slice(0, separator),
            pieces: Number(part.slice(separator + 1))
          };
        })
        : [];
    });
  }

  function improveLineMixBySwaps(assignments) {
    let changed = true;
    let passes = 0;
    const seen = new Set();
    while (changed && passes < 12) {
      passes += 1;
      changed = false;
      const signature = assignmentLineSignature(assignments);
      if (seen.has(signature)) break;
      seen.add(signature);

      const crowded = assignments
        .slice()
        .filter((assignment) => !hasFixedProductLock(assignment))
        .sort((a, b) => linePenalty(b) - linePenalty(a));

      for (const source of crowded) {
        if (linePenalty(source) <= 0) continue;

        const sourceLines = source.lines
          .slice()
          .sort((a, b) => {
            const aTiny = a.pieces < minPiecesFor(source.person);
            const bTiny = b.pieces < minPiecesFor(source.person);
            if (aTiny !== bTiny) return aTiny ? 1 : -1;
            return a.pieces - b.pieces;
          });

        for (const sourceLine of sourceLines) {
          for (const target of assignments) {
            if (target === source) continue;
            if (hasFixedProductLock(target)) continue;
            if (target.lines.some((line) => line.product === sourceLine.product)) continue;

            const targetLine = target.lines.find((line) =>
              line.product !== sourceLine.product
              && line.pieces >= sourceLine.pieces
              && (line.pieces === sourceLine.pieces || line.pieces - sourceLine.pieces >= minPiecesFor(target.person))
              && source.lines.some((item) => item.product === line.product)
            );
            if (!targetLine) continue;

            const before = linePenalty(source) + linePenalty(target);
            const sourceProduct = sourceLine.product;
            const targetProduct = targetLine.product;
            const swapPieces = sourceLine.pieces;
            swapEqualPieces(source, sourceProduct, target, targetProduct, swapPieces);
            const after = linePenalty(source) + linePenalty(target);
            if (after < before) {
              changed = true;
              break;
            }

            swapEqualPieces(source, targetProduct, target, sourceProduct, swapPieces);
          }
          if (changed) break;
        }
        if (changed) break;
      }
    }
  }

  function assignmentLineSignature(assignments) {
    return assignments
      .map((assignment) =>
        assignment.lines
          .slice()
          .sort((a, b) => a.product.localeCompare(b.product, "cs"))
          .map((line) => `${line.product}:${line.pieces}`)
          .join(",")
      )
      .join("|");
  }

  function linePenalty(assignment) {
    const minPieces = minPiecesFor(assignment.person);
    const tinyPenalty = assignment.lines.filter((line) => line.pieces > 0 && line.pieces < minPieces).length * 5;
    const rowLimit = PREFERRED_PRODUCT_ROWS;
    return tinyPenalty + Math.max(0, assignment.lines.length - rowLimit);
  }

  function swapEqualPieces(source, sourceProduct, target, targetProduct, pieces) {
    subtractLine(source, sourceProduct, pieces);
    addLineAmount(source, targetProduct, pieces);
    subtractLine(target, targetProduct, pieces);
    addLineAmount(target, sourceProduct, pieces);
  }

  function subtractLine(assignment, product, pieces) {
    const line = assignment.lines.find((item) => item.product === product);
    if (!line) return;
    line.pieces -= pieces;
    if (line.pieces <= 0) {
      assignment.lines = assignment.lines.filter((item) => item !== line);
    }
  }

  function addLineAmount(assignment, product, pieces) {
    const amount = Math.round(pieces);
    if (amount <= 0) return;
    const existing = assignment.lines.find((line) => line.product === product);
    if (existing) {
      existing.pieces += amount;
    } else {
      assignment.lines.push({ product, pieces: amount });
    }
  }

  function cleanupAssignmentLines(assignments) {
    assignments.forEach((assignment) => {
      assignment.lines = assignment.lines.filter((line) => Math.round(line.pieces) > 0);
    });
  }

  function loadRatio(assignment) {
    if (!assignment.person.capacity) return Number.POSITIVE_INFINITY;
    return assignment.assigned / assignment.person.capacity;
  }

  function isFixedAssignment(assignment) {
    return numberOrZero(assignment.person.fixedPieces) > 0;
  }

  function hasFixedProductLock(assignment) {
    return isFixedAssignment(assignment) && Boolean(normalizeProductName(assignment.person.fixedProduct));
  }

  function canReceiveMovedLine(assignment, movedPieces) {
    return !isFixedAssignment(assignment) || assignment.assigned + movedPieces <= assignment.target;
  }

  function chooseBestProduct(inventory, need, minPieces, rowsLeft = 1, variant = 0) {
    const available = inventory.filter((item) => item.remaining > 0);
    if (!available.length) return null;

    const wholeProduct = chooseWholeProductForMultiLine(available, need, minPieces, rowsLeft);
    if (wholeProduct) return wholeProduct;

    const cleanSingle = available
      .filter((item) => item.remaining >= need && (item.remaining - need === 0 || item.remaining - need >= minPieces))
      .sort((a, b) => (a.remaining - need) - (b.remaining - need));
    if (cleanSingle[0]) return cleanSingle[variant % Math.min(cleanSingle.length, 3)] || cleanSingle[0];

    const exactOrClose = available
      .slice()
      .sort((a, b) => Math.abs(a.remaining - need) - Math.abs(b.remaining - need));
    return exactOrClose[variant % Math.min(exactOrClose.length, 3)] || exactOrClose[0];
  }

  function chooseWholeProductForMultiLine(available, need, minPieces, rowsLeft) {
    if (rowsLeft <= 1) return null;
    return available.find((item) => {
      if (item.remaining >= need || item.remaining < minPieces) return false;
      const restNeed = need - item.remaining;
      if (restNeed <= 0) return false;
      return available.some((other) => {
        if (other === item) return false;
        if (other.remaining < restNeed) return false;
        const leftover = other.remaining - restNeed;
        return leftover === 0 || leftover >= minPieces;
      });
    }) || null;
  }

  function addLine(assignment, product, pieces) {
    const amount = Math.max(0, Math.round(pieces));
    if (!amount) return;
    const existing = assignment.lines.find((line) => line.product === product.name);
    if (existing) {
      existing.pieces += amount;
    } else {
      assignment.lines.push({ product: product.name, pieces: amount });
    }
    assignment.assigned += amount;
    product.remaining -= amount;
  }

  function renderResults(plan) {
    renderWarnings(plan.warnings);
    if (!plan.assignments.length) {
      els.results.className = "results-empty";
      els.results.textContent = "Nejde spočítat. Zkontroluj zadání nahoře.";
      return;
    }

    els.results.className = "result-list";
    const variantNote = document.createElement("div");
    variantNote.className = "variant-note";
    variantNote.textContent = getVariantLabel(plan.variant || 1);
    els.results.replaceChildren(variantNote, ...plan.assignments.map((assignment) => {
      const card = document.createElement("article");
      card.className = "person-result";

      const header = document.createElement("header");
      const title = document.createElement("h3");
      title.textContent = assignment.person.name;
      const meta = document.createElement("div");
      meta.className = "meta";
      const delta = assignment.assigned - assignment.target;
      const percent = assignment.person.capacity > 0
        ? Math.round((assignment.assigned / assignment.person.capacity) * 100)
        : 0;
      meta.textContent = `${percent} % | ${formatPersonHours(assignment)} h | cíl ${assignment.target} ks | rozdíl ${formatSigned(delta)} ks`;
      header.append(title, meta);

      const lines = document.createElement("div");
      lines.className = "assignment-lines";
      if (!assignment.lines.length) {
        const empty = document.createElement("div");
        empty.className = "no-lines";
        empty.textContent = "Bez přiděleného řádku.";
        lines.append(empty);
      } else {
        const lineHours = assignment.lineHours;
        assignment.lines.forEach((line, index) => {
          const row = document.createElement("div");
          row.className = "assignment-line";
          if (line.pieces < minPiecesFor(assignment.person)) row.classList.add("small-line");
          const name = document.createElement("span");
          name.textContent = line.product;
          const pieces = document.createElement("strong");
          pieces.textContent = `${line.pieces} ks`;
          const hours = document.createElement("span");
          hours.className = "line-hours";
          hours.textContent = `${formatNumber(lineHours[index] || 0)} h`;
          row.append(name, pieces, hours);
          lines.append(row);
        });
      }

      card.append(header, lines);
      return card;
    }));
  }

  function getVariantLabel(variant) {
    return `Varianta ${variant}`;
  }

  function renderWarnings(warnings) {
    if (!warnings.length) {
      els.warnings.hidden = true;
      els.warnings.textContent = "";
      return;
    }
    els.warnings.hidden = false;
    els.warnings.innerHTML = warnings.map(escapeHtml).join("<br>");
  }

  function saveAndUpdateSummary() {
    if (state.calculation && !hasCurrentCalculation()) {
      delete state.calculation;
      lastCalculationSignature = "";
      calculationVariant = 0;
      setCalculateVariantHint(false);
      els.results.className = "results-empty";
      els.results.textContent = "Zadání se změnilo. Výsledek je potřeba znovu spočítat.";
      renderWarnings([]);
    }
    const people = cleanPeople();
    const products = cleanProducts();
    const totalPieces = sum(products, "pieces");
    const totalCapacity = people.reduce((acc, person) => acc + effectivePersonPieces(person), 0);
    els.totalPieces.textContent = `${totalPieces} ks`;
    els.productTotal.textContent = `${totalPieces} ks`;
    els.totalCapacity.textContent = `${totalCapacity} ks`;
    els.capacityDelta.textContent = `${formatSigned(totalPieces - totalCapacity)} ks`;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    updateProductionPlanner(true);
  }

  function cleanPeople() {
    return state.people
      .map((person, index) => ({
        ...person,
        name: person.name.trim() || `Člověk ${index + 1}`,
        rate: numberOrZero(person.rate),
        hours: numberOrZero(person.hours),
        fixedPieces: Math.round(numberOrZero(person.fixedPieces)),
        fixedProduct: String(person.fixedProduct || "").trim(),
        capacity: Math.round(numberOrZero(person.rate) * numberOrZero(person.hours))
      }))
      .filter((person) => person.fixedPieces > 0 || (person.rate > 0 && person.hours > 0));
  }

  function cleanProducts() {
    return state.products
      .map((product, index) => ({
        ...product,
        name: product.name.trim() || `Výroba ${index + 1}`,
        noteType: product.noteType || "",
        notePieces: Math.round(numberOrZero(product.notePieces)),
        unfinishedPieces: Math.round(numberOrZero(product.unfinishedPieces)),
        note: product.note || "",
        pieces: Math.round(numberOrZero(product.pieces))
      }))
      .filter((product) => product.pieces > 0);
  }

  function effectivePersonPieces(person) {
    return numberOrZero(person.fixedPieces) > 0 ? Math.round(numberOrZero(person.fixedPieces)) : person.capacity;
  }

  function minPiecesFor(person) {
    return Math.max(1, Math.round(person.rate * state.settings.minRecordHours));
  }

  function normalizeProductName(value) {
    return String(value || "").trim().toLocaleLowerCase("cs-CZ");
  }

  function setInput(root, field, value) {
    const input = root.querySelector(`[data-field="${field}"]`);
    if (input.type === "checkbox") {
      input.checked = Boolean(value);
    } else {
      input.value = value;
    }
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function sum(items, key) {
    return items.reduce((acc, item) => acc + numberOrZero(item[key]), 0);
  }

  function numberOrZero(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function clampNumber(value, min, max) {
    const number = Math.round(numberOrZero(value));
    return Math.min(max, Math.max(min, number));
  }

  function formatSigned(value) {
    return value > 0 ? `+${value}` : String(value);
  }

  function formatPersonHours(assignment) {
    return formatNumber(assignment.assigned > 0 ? assignment.person.hours : 0);
  }

  function allocateLineHours(assignment) {
    if (!assignment.person.rate || !assignment.lines.length) return [];
    const target = assignment.person.hours;
    const exact = assignment.lines.map((line) => line.pieces / assignment.person.rate);
    const values = exact.map((hours) => Math.max(0.5, Math.floor(hours * 2) / 2));
    let sumHours = values.reduce((acc, value) => acc + value, 0);

    while (sumHours + 0.001 < target) {
      const index = exact
        .map((hours, i) => ({ i, rest: hours - values[i] }))
        .sort((a, b) => b.rest - a.rest)[0].i;
      values[index] += 0.5;
      sumHours += 0.5;
    }

    while (sumHours - 0.001 > target) {
      const removable = values
        .map((hours, i) => ({ i, hours, rest: exact[i] - hours }))
        .filter((item) => item.hours > 0.5)
        .sort((a, b) => a.rest - b.rest)[0];
      if (!removable) break;
      values[removable.i] -= 0.5;
      sumHours -= 0.5;
    }

    return values;
  }

  function roundHalf(value) {
    return Math.round(value * 2) / 2;
  }

  function formatNumber(value) {
    return value.toLocaleString("cs-CZ", {
      minimumFractionDigits: value % 1 === 0 ? 0 : 1,
      maximumFractionDigits: 1
    });
  }

  function formatHours(pieces, rate) {
    if (!rate) return "0";
    return formatNumber(roundHalf(pieces / rate));
  }

  function escapeHtml(value) {
    return value.replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[char]);
  }

  function uid() {
    return Math.random().toString(36).slice(2, 10);
  }
})();
