
(() => {
    "use strict";

    // ==========================================
    // CONFIGURACIÓN GENERAL
    // ==========================================

    const ROWS = 8;
    const COLS = 5;
    const TOTAL_CELLS = ROWS * COLS;

    const STORAGE_KEY = "mergerush_save_v2";

    const GOLD_DURATION = 22000;
    const CHAINS_DURATION = 26000;

    const GOLD_INTERVAL = [65000, 85000];
    const CHAINS_INTERVAL = [90000, 115000];

    // Probabilidad de que un bloque tenga moneda.
    const COIN_CHANCE = 0.25;

    const $ = id => document.getElementById(id);

    const boardElement = $("gameBoard");

    // ==========================================
    // VARIABLES DEL JUEGO
    // ==========================================

    let board = Array(TOTAL_CELLS).fill(null);
    let cells = [];

    let coins = 0;
    let score = 0;
    let record = 0;
    let highestBlock = 2;

    let currentBlock = 2;
    let nextBlock = 2;

    // Monedas de los bloques que están por caer.
    let currentBlockCoin = randomCoin();
    let nextBlockCoin = randomCoin();

    let eventType = "normal";
    let eventEndsAt = 0;
    let nextEventAt = Date.now() + 45000;
    let nextEventDuration = 45000;

    let toastTimer = null;
    let gameOver = false;

    // ==========================================
    // GUARDAR Y CARGAR PROGRESO
    // ==========================================

    function loadSave() {
        try {
            const data = JSON.parse(
                localStorage.getItem(STORAGE_KEY) || "{}"
            );

            coins = Number.isFinite(data.coins)
                ? Math.max(0, data.coins)
                : 0;

            record = Number.isFinite(data.record)
                ? Math.max(0, data.record)
                : 0;

            highestBlock = Number.isFinite(data.highestBlock)
                ? Math.max(2, data.highestBlock)
                : 2;

        } catch (error) {
            console.error("Error al cargar el progreso:", error);

            coins = 0;
            record = 0;
            highestBlock = 2;
        }
    }

    function save() {
        try {
            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify({
                    coins,
                    record,
                    highestBlock
                })
            );
        } catch (error) {
            console.error("No se pudo guardar el progreso:", error);
        }
    }

    // ==========================================
    // GENERACIÓN DE BLOQUES
    // ==========================================

    function randomCoin() {
        return Math.random() < COIN_CHANCE;
    }

    function randomNext() {
        const levels = Math.max(
            1,
            Math.floor(
                Math.log2(Math.max(2, highestBlock) / 2)
            ) + 1
        );

        const maxLevel = Math.min(levels, 5);

        const level = Math.floor(
            Math.random() * maxLevel
        );

        return 2 ** (level + 1);
    }

    // Calcula el tono del bloque.
    function hueFor(value) {
        const level = Math.max(
            0,
            Math.round(Math.log2(value / 2))
        );

        return (level * 137.508 + 188) % 360;
    }

    // Degradado visual del bloque.
    function colorFor(value) {
        const hue = hueFor(value);

        return `linear-gradient(
            145deg,
            hsl(${hue} 88% 62%),
            hsl(${hue} 80% 34%)
        )`;
    }

    // Color sólido para luces y sombras.
    function solidColorFor(value) {
        return `hsl(${hueFor(value)} 95% 60%)`;
    }

    // ==========================================
    // CREACIÓN DEL TABLERO
    // ==========================================

    function createBoard() {
        boardElement.innerHTML = "";
        cells = [];

        for (let i = 0; i < TOTAL_CELLS; i++) {
            const cell = document.createElement("div");

            cell.className = "board-cell";
            cell.dataset.index = i;

            cell.addEventListener("click", () => {
                dropInColumn(i % COLS);
            });

            cell.addEventListener("mouseenter", () => {
                updateGhost(i % COLS);
            });

            boardElement.appendChild(cell);
            cells.push(cell);
        }

        boardElement.addEventListener("mouseleave", hideGhost);

        render();
    }

    // ==========================================
    // ESTELA DE CAÍDA
    // ==========================================

    function animateBlockDrop(col, targetRow, value) {
        const firstCell = cells[indexAt(0, col)];
        const targetCell = cells[indexAt(targetRow, col)];

        if (!firstCell || !targetCell) return;

        const boardRect = boardElement.getBoundingClientRect();

        const firstRect = firstCell.getBoundingClientRect();
        const targetRect = targetCell.getBoundingClientRect();

        const offsetX = boardRect.left + boardElement.clientLeft;
        const offsetY = boardRect.top + boardElement.clientTop;

        const width = targetRect.width * 0.85;
        const height = targetRect.height * 0.85;

        const left =
            targetRect.left - offsetX +
            (targetRect.width - width) / 2;

        const startY = firstRect.top - offsetY - height;

        const endY =
            targetRect.top - offsetY +
            (targetRect.height - height) / 2;

        const distance = endY - startY;

        if (distance <= 0) return;

        const block = document.createElement("div");

        block.className = "fall-trail";
        block.textContent = value;

        block.style.left = `${left}px`;
        block.style.top = `${startY}px`;
        block.style.width = `${width}px`;
        block.style.height = `${height}px`;

        block.style.setProperty(
            "--block-gradient",
            colorFor(value)
        );

        block.style.setProperty(
            "--trail-color",
            solidColorFor(value)
        );

        block.style.setProperty(
            "--fall-distance",
            `${distance}px`
        );

        boardElement.appendChild(block);

        block.animate(
            [
                { transform: "translateY(0)" },
                { transform: `translateY(${distance}px)` }
            ],
            {
                duration: 430,
                easing: "cubic-bezier(.22,.75,.35,1)",
                fill: "forwards"
            }
        );

        setTimeout(() => block.remove(), 500);
    }

    // ==========================================
    // BLOQUE FANTASMA
    // ==========================================

    function updateGhost(col) {
        if (gameOver) return;

        let row = ROWS - 1;

        while (
            row >= 0 &&
            board[indexAt(row, col)] !== null
        ) {
            row--;
        }

        hideGhost();

        if (row < 0) return;

        const position = indexAt(row, col);
        const ghost = document.createElement("div");

        ghost.className = "ghost-block";
        ghost.textContent = currentBlock;

        ghost.style.setProperty(
            "--block-color",
            colorFor(currentBlock)
        );

        ghost.style.setProperty(
            "--block-gradient",
            colorFor(currentBlock)
        );

        ghost.style.setProperty(
            "--block-solid",
            solidColorFor(currentBlock)
        );

        cells[position].appendChild(ghost);
    }

    function hideGhost() {
        cells.forEach(cell => {
            const ghost = cell.querySelector(".ghost-block");

            if (ghost) {
                ghost.remove();
            }
        });
    }

    // ==========================================
    // DIBUJAR LOS BLOQUES
    // ==========================================

    function render() {
        board.forEach((block, index) => {
            const cell = cells[index];

            if (!cell) return;

            cell.innerHTML = "";

            if (!block) return;

            const tile = document.createElement("div");

            tile.className = "number-block";
            tile.style.position = "relative";

            if (block.locked) {
                tile.classList.add("locked");
            }

            // Número centrado en el bloque.
            const number = document.createElement("span");

            number.className = "block-number";
            number.textContent = block.value;

            number.style.position = "absolute";
            number.style.inset = "0";
            number.style.display = "flex";
            number.style.alignItems = "center";
            number.style.justifyContent = "center";
            number.style.width = "100%";
            number.style.height = "100%";
            number.style.pointerEvents = "none";

            tile.appendChild(number);

            // Apariencia durante Fiebre de Oro.
            if (eventType === "gold" && !block.locked) {
                tile.classList.add("gold");
            } else {
                tile.style.background = colorFor(block.value);
            }

            // Mostrar moneda solamente en modo normal
            // y cuando el bloque no está encadenado.
            if (
                block.hasCoin &&
                eventType !== "gold" &&
                !block.locked
            ) {
                const coin = document.createElement("span");

                coin.className = "coin-indicator";
                coin.textContent = "🪙";

                coin.style.position = "absolute";
                coin.style.bottom = "3px";
                coin.style.left = "50%";
                coin.style.transform = "translateX(-50%)";
                coin.style.fontSize = "clamp(9px, 2.5vw, 13px)";
                coin.style.lineHeight = "1";
                coin.style.pointerEvents = "none";
                coin.style.zIndex = "2";

                tile.appendChild(coin);
            }

            // Distintivo de bloque encadenado.
            if (block.locked) {
                const lock = document.createElement("span");

                lock.className = "lock-symbol";
                lock.textContent = "🔗";

                tile.appendChild(lock);
            }

            cell.appendChild(tile);
        });

        $("coins").textContent = coins.toLocaleString("es-PE");
        $("record").textContent = record.toLocaleString("es-PE");
        $("accumulation").textContent = score.toLocaleString("es-PE");

        $("currentBlock").textContent = currentBlock;
        $("nextBlock").textContent = nextBlock;

        $("currentBlock").style.background =
            eventType === "gold"
                ? ""
                : colorFor(currentBlock);

        $("nextBlock").style.background = colorFor(nextBlock);

        $("currentBlock").classList.toggle(
            "gold",
            eventType === "gold"
        );
    }

    // ==========================================
    // MENSAJES DEL JUEGO
    // ==========================================

    function showToast(message, duration = 2400) {
        const toast = $("toast");

        toast.textContent = message;
        toast.classList.add("show");

        clearTimeout(toastTimer);

        toastTimer = setTimeout(() => {
            toast.classList.remove("show");
        }, duration);
    }

    // ==========================================
    // POSICIONES Y VECINOS
    // ==========================================

    function indexAt(row, col) {
        return row * COLS + col;
    }

    function neighbors(index) {
        const row = Math.floor(index / COLS);
        const col = index % COLS;

        return [
            [row - 1, col],
            [row + 1, col],
            [row, col - 1],
            [row, col + 1]
        ]
        .filter(([r, c]) =>
            r >= 0 &&
            r < ROWS &&
            c >= 0 &&
            c < COLS
        )
        .map(([r, c]) => indexAt(r, c));
    }

    // ==========================================
    // SOLTAR BLOQUES
    // ==========================================

    function dropInColumn(col) {
        if (gameOver) return;

        if (col < 0 || col >= COLS) return;

        let row = ROWS - 1;

        while (
            row >= 0 &&
            board[indexAt(row, col)] !== null
        ) {
            row--;
        }

        if (row < 0) {
            showToast("¡Esta columna está llena!");
            return;
        }

        const position = indexAt(row, col);

        // Ejecutar la estela antes de actualizar el tablero.
        animateBlockDrop(col, row, currentBlock);

        // Crear el bloque con su posibilidad de moneda.
        board[position] = {
            value: currentBlock,
            locked: false,
            hasCoin: eventType !== "gold" && currentBlockCoin
        };

        score += currentBlock;

        // Pasar al siguiente bloque.
        currentBlock = nextBlock;
        currentBlockCoin = nextBlockCoin;

        nextBlock = randomNext();
        nextBlockCoin = randomCoin();

        hideGhost();

        resolveMerges(position);

        render();
        save();

        if (board.every(Boolean)) {
            gameOver = true;

            showToast(
                "¡Tablero lleno! Toca ↻ para comenzar otro tablero",
                4000
            );
        }
    }

    // ==========================================
    // ANIMACIÓN DE FUSIÓN
    // ==========================================

    function animateMerge(sourceIndex, targetIndex, newValue) {
        const sourceCell = cells[sourceIndex];
        const targetCell = cells[targetIndex];

        if (!sourceCell || !targetCell) return;

        const boardRect = boardElement.getBoundingClientRect();

        const sourceRect = sourceCell.getBoundingClientRect();
        const targetRect = targetCell.getBoundingClientRect();

        const offsetX = boardRect.left + boardElement.clientLeft;
        const offsetY = boardRect.top + boardElement.clientTop;

        const width = sourceRect.width * 0.85;
        const height = sourceRect.height * 0.85;

        const startX =
            sourceRect.left - offsetX +
            (sourceRect.width - width) / 2;

        const startY =
            sourceRect.top - offsetY +
            (sourceRect.height - height) / 2;

        const endX =
            targetRect.left - offsetX +
            (targetRect.width - width) / 2;

        const endY =
            targetRect.top - offsetY +
            (targetRect.height - height) / 2;

        const block = document.createElement("div");

        block.className = "merge-flight";
        block.textContent = board[sourceIndex].value;

        block.style.left = `${startX}px`;
        block.style.top = `${startY}px`;
        block.style.width = `${width}px`;
        block.style.height = `${height}px`;

        block.style.background = colorFor(
            board[sourceIndex].value
        );

        block.style.setProperty(
            "--trail-color",
            solidColorFor(board[sourceIndex].value)
        );

        boardElement.appendChild(block);

        const distanceX = endX - startX;
        const distanceY = endY - startY;

        block.animate(
            [
                {
                    transform: "translate(0,0) scale(1)",
                    opacity: 1
                },
                {
                    transform: `translate(${distanceX * .7}px,${distanceY * .7}px) scale(1.08)`,
                    opacity: 1,
                    offset: .75
                },
                {
                    transform: `translate(${distanceX}px,${distanceY}px) scale(.2)`,
                    opacity: 0
                }
            ],
            {
                duration: 300,
                easing: "ease-in",
                fill: "forwards"
            }
        );

        // Impacto de color al llegar al bloque receptor.
        const impact = document.createElement("div");

        impact.className = "merge-impact";

        impact.style.setProperty(
            "--trail-color",
            solidColorFor(newValue)
        );

        impact.style.width = `${width * .7}px`;
        impact.style.height = `${height * .7}px`;
        impact.style.left = `${endX + width * .15}px`;
        impact.style.top = `${endY + height * .15}px`;

        boardElement.appendChild(impact);

        impact.animate(
            [
                {
                    transform: "scale(.2)",
                    opacity: 0
                },
                {
                    transform: "scale(1.5)",
                    opacity: .4,
                    offset: .5
                },
                {
                    transform: "scale(2)",
                    opacity: 0
                }
            ],
            {
                duration: 350,
                easing: "ease-out"
            }
        );

        setTimeout(() => {
            block.remove();
            impact.remove();
        }, 400);
    }

    // ==========================================
    // SISTEMA DE FUSIONES Y RECOMPENSAS
    // ==========================================

    function resolveMerges(start) {
        let changed = true;
        let safety = 0;

        while (changed && safety++ < 100) {
            changed = false;

            for (let i = TOTAL_CELLS - 1; i >= 0; i--) {
                const block = board[i];

                if (!block || block.locked) continue;

                const adjacent = neighbors(i).find(index => {
                    const other = board[index];

                    return other &&
                        !other.locked &&
                        other.value === block.value;
                });

                if (adjacent === undefined) continue;

                const otherBlock = board[adjacent];

                const newValue = block.value * 2;

                // Animar el bloque que viaja hacia el otro.
                animateMerge(adjacent, i, newValue);

                // Comprobar si la fusión entrega monedas.
                const earnsCoins =
                    eventType === "gold" ||
                    block.hasCoin ||
                    otherBlock.hasCoin;

                const baseReward = Math.max(
                    1,
                    Math.round(Math.log2(newValue) * 2)
                );

                if (eventType === "gold") {
                    // Todas las fusiones dan el doble.
                    coins += baseReward * 2;

                } else if (earnsCoins) {
                    // En modo normal solo cuentan los bloques marcados.
                    coins += baseReward;
                }

                // Crear el nuevo bloque.
                // La moneda se consume durante la fusión.
                board[i] = {
                    value: newValue,
                    locked: false,
                    hasCoin: false
                };

                // El bloque que viajó desaparece.
                board[adjacent] = null;

                score += newValue;

                // Actualizar récord.
                if (newValue > highestBlock) {
                    highestBlock = newValue;

                    if (newValue > record) {
                        record = newValue;
                        showRecordEffect(i, newValue);
                    }
                }

                showToast(`¡Fusión! ${newValue}`, 900);

                // Desbloquear bloques encadenados vecinos.
                neighbors(i).forEach(index => {
                    const nearby = board[index];

                    if (nearby && nearby.locked) {
                        nearby.locked = false;

                        showToast(
                            "🔓 ¡Has roto una cadena!",
                            1200
                        );
                    }
                });

                changed = true;

                render();

                // Una fusión por recorrido.
                break;
            }

            if (changed) {
                applyGravity();
            }
        }

        render();
        save();
    }

    // ==========================================
    // EFECTO DE NUEVO RÉCORD
    // ==========================================

    function showRecordEffect(index, value) {
        showToast(`🏆 ¡NUEVO RÉCORD! ${value}`, 2600);

        const cell = cells[index];

        if (!cell) return;

        const tile = cell.querySelector(".number-block");

        if (tile) {
            tile.classList.add("pop");
        }

        const rect = cell.getBoundingClientRect();

        for (let i = 0; i < 18; i++) {
            const particle = document.createElement("div");

            particle.style.position = "fixed";
            particle.style.width = "7px";
            particle.style.height = "7px";
            particle.style.borderRadius = "50%";
            particle.style.background = "gold";
            particle.style.boxShadow = "0 0 12px orange";
            particle.style.pointerEvents = "none";
            particle.style.zIndex = "9999";

            particle.style.left = `${rect.left + rect.width / 2}px`;
            particle.style.top = `${rect.top + rect.height / 2}px`;

            const angle = Math.random() * Math.PI * 2;
            const distance = 35 + Math.random() * 75;

            document.body.appendChild(particle);

            particle.animate([
                {
                    transform: "translate(0, 0) scale(1)",
                    opacity: 1
                },
                {
                    transform: `translate(
                        ${Math.cos(angle) * distance}px,
                        ${Math.sin(angle) * distance}px
                    ) scale(0)`,
                    opacity: 0
                }
            ], {
                duration: 900,
                easing: "ease-out"
            });

            setTimeout(() => particle.remove(), 950);
        }
    }

    // ==========================================
    // GRAVEDAD
    // ==========================================

    function applyGravity() {
        for (let col = 0; col < COLS; col++) {
            let segmentStart = 0;

            for (let row = 0; row <= ROWS; row++) {
                const isAnchor =
                    row === ROWS ||
                    (
                        board[indexAt(row, col)] &&
                        board[indexAt(row, col)].locked
                    );

                if (!isAnchor) continue;

                const segment = [];

                // Recoger bloques del segmento.
                for (let r = segmentStart; r < row; r++) {
                    const block = board[indexAt(r, col)];

                    if (block) {
                        segment.push(block);
                    }
                }

                // Vaciar el segmento.
                for (let r = segmentStart; r < row; r++) {
                    board[indexAt(r, col)] = null;
                }

                // Colocar los bloques hacia abajo.
                const writeStart = row - segment.length;

                segment.forEach((block, k) => {
                    board[indexAt(writeStart + k, col)] = block;
                });

                // El bloque encadenado permanece como ancla.
                segmentStart = row + 1;
            }
        }
    }

    // ==========================================
    // EVENTOS AUTOMÁTICOS
    // ==========================================

    function randomBetween(min, max) {
        return Math.floor(
            min + Math.random() * (max - min)
        );
    }

    function startEvent(type) {
        eventType = type;

        eventEndsAt = Date.now() + (
            type === "gold"
                ? GOLD_DURATION
                : CHAINS_DURATION
        );

        document.body.classList.remove(
            "map-normal",
            "map-gold",
            "map-chains"
        );

        if (type === "gold") {
            document.body.classList.add("map-gold");

            $("eventIcon").textContent = "✨";
            $("eventName").textContent = "FIEBRE DE ORO";

            $("eventDetail").textContent =
                "¡Todas las fusiones dan el doble de monedas!";

            showToast("✨ ¡COMIENZA LA FIEBRE DE ORO!", 3000);

        } else {
            document.body.classList.add("map-chains");

            $("eventIcon").textContent = "⛓️";
            $("eventName").textContent = "LLUVIA DE CADENAS";

            $("eventDetail").textContent =
                "Fusiona junto a los bloques para romper sus cadenas";

            lockSomeBlocks();

            showToast(
                "⛓️ ¡Han aparecido bloques encadenados!",
                3000
            );
        }

        render();
    }

    // ==========================================
    // MINIJUEGO: BLOQUES ENCADENADOS
    // ==========================================

    function lockSomeBlocks() {
        const candidates = board
            .map((block, index) =>
                block && !block.locked ? index : -1
            )
            .filter(index => index >= 0);

        if (candidates.length === 0) {
            // Si el tablero está vacío, aparecen obstáculos.
            for (let col = 0; col < 2; col++) {
                let row = ROWS - 1;

                while (
                    row >= 0 &&
                    board[indexAt(row, col)] !== null
                ) {
                    row--;
                }

                if (row >= 0) {
                    board[indexAt(row, col)] = {
                        value: 2,
                        locked: true,
                        hasCoin: false
                    };
                }
            }

        } else {
            const amount = Math.min(3, candidates.length);

            for (let i = 0; i < amount; i++) {
                const randomIndex = Math.floor(
                    Math.random() * candidates.length
                );

                const selected = candidates.splice(
                    randomIndex,
                    1
                )[0];

                board[selected].locked = true;
            }
        }
    }

    // ==========================================
    // TERMINAR EVENTOS
    // ==========================================

    function endEvent() {
        const ended = eventType;

        eventType = "normal";
        eventEndsAt = 0;

        document.body.classList.remove(
            "map-gold",
            "map-chains"
        );

        document.body.classList.add("map-normal");

        $("eventIcon").textContent = "🌲";
        $("eventName").textContent = "Bosque tranquilo";

        $("eventDetail").innerHTML =
            'Próximo evento en <span id="eventCountdown">00:00</span>';

        if (ended === "chains") {
            // Los bloques que no fueron liberados
            // permanecen encadenados en el tablero.
            // No se desbloquean ni se eliminan.
            showToast("🌲 El bosque vuelve a la calma");

        } else {
            showToast("✨ La fiebre de oro ha terminado");
        }

        const gap = ended === "gold"
            ? randomBetween(...CHAINS_INTERVAL)
            : randomBetween(...GOLD_INTERVAL);

        nextEventAt = Date.now() + gap;
        nextEventDuration = gap;

        render();
        save();
    }

    // ==========================================
    // RELOJ DE EVENTOS
    // ==========================================

    function updateEventClock() {
        const now = Date.now();

        if (
            eventType !== "normal" &&
            now >= eventEndsAt
        ) {
            endEvent();
        }

        if (
            eventType === "normal" &&
            now >= nextEventAt
        ) {
            startEvent(
                Math.random() < 0.58
                    ? "gold"
                    : "chains"
            );
        }

        const countdown = eventType === "normal"
            ? Math.max(0, nextEventAt - now)
            : Math.max(0, eventEndsAt - now);

        const seconds = Math.ceil(countdown / 1000);

        const clock = $("eventCountdown");

        if (clock) {
            clock.textContent =
                `${String(Math.floor(seconds / 60)).padStart(2, "0")}:` +
                `${String(seconds % 60).padStart(2, "0")}`;
        }

        const duration = eventType === "normal"
            ? nextEventDuration
            : eventType === "gold"
                ? GOLD_DURATION
                : CHAINS_DURATION;

        const progress = duration > 0
            ? 1 - countdown / duration
            : 0;

        $("eventProgress").style.width =
            `${Math.max(0, Math.min(1, progress)) * 100}%`;
    }

    // ==========================================
    // NUEVA PARTIDA
    // ==========================================

    function newBoard() {
        board = Array(TOTAL_CELLS).fill(null);

        score = 0;

        currentBlock = 2;
        nextBlock = 2;

        // Generar nuevos distintivos aleatorios.
        currentBlockCoin = randomCoin();
        nextBlockCoin = randomCoin();

        gameOver = false;

        hideGhost();
        render();
        save();

        showToast("Nuevo tablero: ¡a jugar!");
    }

    // ==========================================
    // MENÚ
    // ==========================================

    $("menuButton").addEventListener("click", () => {
        $("menuOverlay").classList.add("open");
    });

    $("closeMenu").addEventListener("click", () => {
        $("menuOverlay").classList.remove("open");
    });

    $("continueButton").addEventListener("click", () => {
        $("menuOverlay").classList.remove("open");
    });

    $("exitButton").addEventListener("click", newBoard);

    $("resetProgressButton").addEventListener("click", () => {
        if (!confirm("¿Borrar las monedas y el récord guardados?")) {
            return;
        }

        localStorage.removeItem(STORAGE_KEY);

        coins = 0;
        record = 0;
        highestBlock = 2;

        newBoard();

        $("menuOverlay").classList.remove("open");

        showToast("Progreso borrado");
    });

    // ==========================================
    // INICIAR JUEGO
    // ==========================================

    loadSave();

    currentBlock = 2;
    nextBlock = 2;

    createBoard();

    updateEventClock();

    setInterval(updateEventClock, 250);

})();
