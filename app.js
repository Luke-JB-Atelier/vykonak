(function () {
  const STORAGE_KEY = "vykonak-kalkulator-v2";
  const RECORDS_KEY = "vykonak-denni-zaznamy-v1";

  const state = loadState() || {
    people: [
      { id: uid(), name: "Já", rate: 45, hours: 6, fixedPieces: 0, keeper: true },
      { id: uid(), name: "Kolega 1", rate: 45, hours: 6, fixedPieces: 0, keeper: false },
      { id: uid(), name: "Kolega 2", rate: 25, hours: 6, fixedPieces: 0, keeper: false },
      { id: uid(), name: "Kolega 3", rate: 50, hours: 6, fixedPieces: 0, keeper: false }
    ],
    products: [
      { id: uid(), name: "", pieces: 0, noteType: "", notePieces: 0, note: "", color: "" }
    ],
    settings: {
      maxRows: 2,
      minRecordHours: 0.5,
      productionColor: ""
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
    maxRows: document.querySelector("#maxRows"),
    minRecordHours: document.querySelector("#minRecordHours"),
    warnings: document.querySelector("#warnings"),
    results: document.querySelector("#results"),
    quickProducts: document.querySelector("#quickProducts"),
    installApp: document.querySelector("#installApp"),
    calcSheet: document.querySelector("#calcSheet"),
    calcExpression: document.querySelector("#calcExpression"),
    calcResult: document.querySelector("#calcResult"),
    calcApply: document.querySelector("#calcApply"),
    calcClose: document.querySelector("#calcClose"),
    calcBackspace: document.querySelector("#calcBackspace"),
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
  let lastCalculationSignature = "";
  let calculationVariant = 0;

  document.querySelector("#addPerson").addEventListener("click", () => {
    state.people.push({ id: uid(), name: "", rate: 45, hours: 6, fixedPieces: 0, keeper: false });
    render();
  });

  document.querySelector("#addProduct").addEventListener("click", () => {
    toggleProductPicker();
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
  });

  els.installApp.addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice.catch(() => null);
    deferredInstallPrompt = null;
    els.installApp.hidden = true;
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    els.installApp.hidden = true;
  });

  document.querySelector("#resetApp").addEventListener("click", () => {
    if (!confirm("Opravdu vymazat zadání a výsledek?")) return;
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  });

  els.calcClose.addEventListener("click", closeCalculator);
  els.calcSheet.querySelector("[data-calc-close]").addEventListener("click", closeCalculator);
  els.calcExpression.addEventListener("input", updateCalculatorResult);
  els.calcBackspace.addEventListener("click", () => {
    els.calcExpression.value = els.calcExpression.value.slice(0, -1);
    updateCalculatorResult();
  });
  els.calcApply.addEventListener("click", applyCalculator);
  els.calcSheet.addEventListener("click", (event) => {
    const keyButton = event.target.closest("[data-calc-key]");
    if (keyButton) {
      els.calcExpression.value += keyButton.dataset.calcKey;
      updateCalculatorResult();
      return;
    }
    if (event.target.closest("[data-calc-clear]")) {
      els.calcExpression.value = "";
      updateCalculatorResult();
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

  els.maxRows.addEventListener("change", () => {
    state.settings.maxRows = Number(els.maxRows.value);
    saveAndUpdateSummary();
  });

  els.minRecordHours.addEventListener("change", () => {
    state.settings.minRecordHours = Number(els.minRecordHours.value);
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
    });
  }

  render();

  function handleCalculate(scrollToResults) {
    renderResults(calculateNextPlan());
    setCalculateVariantHint(true);
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
    els.maxRows.value = String(state.settings.maxRows);
    els.minRecordHours.value = String(state.settings.minRecordHours);
    els.productionColor.value = state.settings.productionColor || "";
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
      setInput(node, "keeper", person.keeper);
      const nameInput = node.querySelector('[data-field="name"]');
      const nameSuggestions = node.querySelector(".name-suggestions");

      node.addEventListener("input", (event) => {
        const field = event.target.dataset.field;
        if (!field) return;
        if (field === "keeper") {
          person.keeper = event.target.checked;
        } else if (field === "name") {
          person.name = event.target.value;
          renderNameSuggestions(nameInput, nameSuggestions, person);
        } else {
          person[field] = Number(event.target.value);
        }
        saveAndUpdateSummary();
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
      const node = els.productTemplate.content.firstElementChild.cloneNode(true);
      setInput(node, "name", product.name);
      setInput(node, "pieces", product.pieces);
      setInput(node, "noteType", product.noteType || "");
      setInput(node, "note", product.note || "");
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
        if (field === "name" || field === "noteType" || field === "note") {
          product[field] = event.target.value;
        } else {
          product[field] = Number(event.target.value);
        }
        if (field === "noteType" || field === "pieces") {
          fillProductInfoPieces(product, field === "noteType");
        }
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
    if (!product.noteType || !["doplneno", "rozpracovana"].includes(product.noteType)) return;

    const boxPieces = defaultBoxPieces();
    const pieces = Math.round(numberOrZero(product.pieces));
    if (!pieces || !boxPieces) return;

    const remainder = pieces % boxPieces;
    if (!remainder) {
      product.notePieces = "";
      return;
    }

    product.notePieces = remainder;
  }

  function updateProductBreakdown(product, element) {
    if (!element) return;
    element.textContent = formatProductBreakdown(product);
  }

  function formatProductBreakdown(product) {
    const boxPieces = defaultBoxPieces();
    const pieces = Math.round(numberOrZero(product.pieces));
    if (!pieces || !boxPieces) return "";

    const manualPart = Math.round(numberOrZero(product.notePieces));
    const isPartial = ["doplneno", "rozpracovana"].includes(product.noteType || "");
    const part = isPartial && manualPart > 0 ? manualPart : pieces % boxPieces;
    const parts = [];

    if (product.noteType === "doplneno" && part > 0) {
      parts.push(`${part} doplněno`);
    }

    const wholeBase = isPartial ? pieces - part : pieces;
    const wholeBoxes = Math.max(0, Math.floor(wholeBase / boxPieces));
    if (wholeBoxes <= 4) {
      for (let i = 0; i < wholeBoxes; i += 1) parts.push(`${boxPieces} celé`);
    } else {
      parts.push(`${wholeBoxes} celé x ${boxPieces}`);
    }

    if (product.noteType === "rozpracovana" && part > 0) {
      parts.push(`${part} zbylo`);
    } else if (!isPartial && part > 0) {
      parts.push(`${part} ks navíc`);
    }

    return parts.length ? parts.join(" + ") : `${pieces} ks`;
  }

  function normalizeState(data) {
    data.settings = data.settings || {};
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
    data.people = (data.people || []).map((person) => ({
      ...person,
      name: person.name === "Ja" ? "Já" : person.name
    }));
  }

  function normalizeProductionColor(color) {
    if (color === "gold") return "honey";
    return color || "";
  }

  function isUlProductionColor(color) {
    return ["green-ul", "honey", "bordeaux"].includes(normalizeProductionColor(color));
  }

  function migrateProductNote(product) {
    product.note = product.note || "";
    product.noteType = product.noteType || "";
    product.notePieces = Math.round(numberOrZero(product.notePieces));

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
    input.blur();
    els.calcExpression.value = input.value ? String(input.value) : "";
    els.calcApply.hidden = false;
    els.calcSheet.hidden = false;
    updateCalculatorResult();
  }

  function openStandaloneCalculator() {
    activeCalculator = null;
    els.calcExpression.value = "";
    els.calcApply.hidden = true;
    els.calcSheet.hidden = false;
    updateCalculatorResult();
  }

  function closeCalculator() {
    els.calcSheet.hidden = true;
    activeCalculator = null;
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
    return JSON.stringify({
      people: state.people.map((person) => ({
        name: person.name,
        rate: person.rate,
        hours: person.hours,
        fixedPieces: person.fixedPieces,
        keeper: person.keeper
      })),
      products: state.products.map((product) => ({
        name: product.name,
        pieces: product.pieces
      })),
      settings: {
        maxRows: state.settings.maxRows,
        minRecordHours: state.settings.minRecordHours
      }
    });
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
    if (!totalCapacity) warnings.push("Kapacita party je nula.");
    if (warnings.length) return { people, products, totalPieces, totalCapacity, warnings, assignments: [] };

    const keepers = people.filter((person) => person.keeper);
    const fallbackKeepers = keepers.length ? keepers : [people[0]];
    const targets = calculateTargets(people, totalPieces, warnings);
    const assignments = people.map((person) => ({
      person,
      lines: [],
      assigned: 0,
      target: targets.get(person.id) || 0
    }));

    const inventory = orderProductsForVariant(products, variantIndex)
      .map((product) => ({ ...product, remaining: product.pieces }));

    const regularAssignments = orderAssignmentsForVariant(
      assignments.filter((item) => !item.person.keeper),
      variantIndex
    );

    const keeperAssignments = orderAssignmentsForVariant(
      assignments.filter((item) => item.person.keeper),
      variantIndex + 2
    );

    regularAssignments.forEach((assignment) => {
      fillPractical(assignment, inventory, state.settings.maxRows, minPiecesFor(assignment.person), variantIndex);
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
      if (isFixedAssignment(assignment) && assignment.assigned !== assignment.target) {
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
    const records = loadRecords();
    const now = new Date();
    const products = cleanProducts();
    const people = cleanPeople();
    const totalPieces = sum(products, "pieces");
    records.unshift({
      id: uid(),
      savedAt: now.toISOString(),
      title: formatRecordTitle(now),
      summary: `${totalPieces} ks | ${people.length} členů party`,
      state: cloneCurrentState()
    });
    localStorage.setItem(RECORDS_KEY, JSON.stringify(records.slice(0, 80)));
    renderWarnings([`Uloženo: ${formatRecordTitle(now)}.`]);
  }

  function openRecordLoader() {
    const records = loadRecords();
    els.recordSheet.hidden = false;
    renderRecordList(records);
  }

  function closeRecordLoader() {
    els.recordSheet.hidden = true;
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
    state.people = (record.state && record.state.people) ? record.state.people : [];
    state.products = (record.state && record.state.products) ? record.state.products : [];
    const recordSettings = (record.state && record.state.settings) ? record.state.settings : {};
    const recordColor = "productionColor" in recordSettings
      ? recordSettings.productionColor
      : inferProductionColor(record.state && record.state.products);
    state.settings = {
      ...state.settings,
      ...recordSettings,
      productionColor: recordColor || ""
    };
    normalizeState(state);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    closeRecordLoader();
    render();
    renderWarnings([`Načteno: ${record.title || "uložený záznam"}.`]);
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
      settings: state.settings
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

  function fillPractical(assignment, inventory, maxRows, minPieces, variant = 0) {
    let rowsLeft = maxRows;
    while (rowsLeft > 0 && assignment.assigned < assignment.target) {
      const need = assignment.target - assignment.assigned;
      const product = chooseBestProduct(inventory, need, minPieces, variant + rowsLeft);
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
      source.lines.forEach((sourceLine) => {
        if (sourceLine.pieces < minPiecesFor(source.person)) return;

        assignments.forEach((target, targetIndex) => {
          if (target === source) return;

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
      const rowLimit = isFixedAssignment(assignment) ? 2 : state.settings.maxRows;
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
    const rowLimit = isFixedAssignment(assignment) ? 2 : state.settings.maxRows;
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

  function canReceiveMovedLine(assignment, movedPieces) {
    return !isFixedAssignment(assignment) || assignment.assigned + movedPieces <= assignment.target;
  }

  function chooseBestProduct(inventory, need, minPieces, variant = 0) {
    const available = inventory.filter((item) => item.remaining > 0);
    if (!available.length) return null;

    const cleanSingle = available
      .filter((item) => item.remaining >= need && (item.remaining - need === 0 || item.remaining - need >= minPieces))
      .sort((a, b) => (a.remaining - need) - (b.remaining - need));
    if (cleanSingle[0]) return cleanSingle[variant % Math.min(cleanSingle.length, 3)] || cleanSingle[0];

    const exactOrClose = available
      .slice()
      .sort((a, b) => Math.abs(a.remaining - need) - Math.abs(b.remaining - need));
    return exactOrClose[variant % Math.min(exactOrClose.length, 3)] || exactOrClose[0];
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
        const lineHours = allocateLineHours(assignment);
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
    if (variant === 1) return "Varianta 1 - nejpraktičtější";
    return `Varianta ${variant} - alternativa`;
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
    const people = cleanPeople();
    const products = cleanProducts();
    const totalPieces = sum(products, "pieces");
    const totalCapacity = people.reduce((acc, person) => acc + person.capacity, 0);
    els.totalPieces.textContent = `${totalPieces} ks`;
    els.productTotal.textContent = `${totalPieces} ks`;
    els.totalCapacity.textContent = `${totalCapacity} ks`;
    els.capacityDelta.textContent = `${formatSigned(totalPieces - totalCapacity)} ks`;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function cleanPeople() {
    return state.people
      .map((person, index) => ({
        ...person,
        name: person.name.trim() || `Člověk ${index + 1}`,
        rate: numberOrZero(person.rate),
        hours: numberOrZero(person.hours),
        fixedPieces: Math.round(numberOrZero(person.fixedPieces)),
        capacity: Math.round(numberOrZero(person.rate) * numberOrZero(person.hours))
      }))
      .filter((person) => person.rate > 0 && person.hours > 0);
  }

  function cleanProducts() {
    return state.products
      .map((product, index) => ({
        ...product,
        name: product.name.trim() || `Výroba ${index + 1}`,
        noteType: product.noteType || "",
        notePieces: Math.round(numberOrZero(product.notePieces)),
        note: product.note || "",
        pieces: Math.round(numberOrZero(product.pieces))
      }))
      .filter((product) => product.pieces > 0);
  }

  function minPiecesFor(person) {
    return Math.max(1, Math.round(person.rate * state.settings.minRecordHours));
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

