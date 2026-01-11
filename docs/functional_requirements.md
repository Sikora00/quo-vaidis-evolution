# Wymagania Funkcjonalne Aplikacji "Quo Vaidis Evolution"

Dokument ten definiuje wymagania funkcjonalne dla symulatora ewolucyjnego opartego na opisie z książki "Quo Vaidis" Andrzeja Dragana. Celem aplikacji jest symulacja procesów ewolucyjnych w dwuwymiarowym środowisku.

## 1. Etapy Rozwoju (Milestones)

Aplikacja zostanie zaimplementowana w czterech głównych etapach, odzwierciedlających proces opisany w materiale źródłowym.

### Etap 1: Geneza Świata (Środowisko i Podstawowe Obiekty)
Stworzenie fizycznego świata symulacji, mechanizmów czasu i podstawowych bytów.
- Implementacja planszy 2D.
- Generator losowych obiektów (jedzenie, trucizna).
- Umieszczenie populacji startowej (ludziki).
- Podstawowa pętla symulacji (tury).

### Etap 2: Prawa Natury (Logika Agentów i Interakcje)
Implementacja zasad rządzących życiem, śmiercią i zachowaniem agentów.
- Mechanika energii (zużycie, zdobywanie).
- System DNA determinujący ruch.
- Interakcje: jedzenie, walka, rozmnażanie.
- Śmierć (z głodu, w walce).

### Etap 3: Obserwatorium (Statystyki i UI)
Narzędzia do analizy i kontroli symulacji.
- Panel sterowania parametrami (szybkość, ilość).
- Wizualizacja statystyk DNA na żywo (osobne okno/panel).
- Wykresy populacji.

### Etap 4: Przemijanie (Starzenie i Ewolucja Czasu Życia)
Dodanie mechaniki starzenia się i ewolucji długości życia.
- Parametr wieku i maksymalnego czasu życia.
- Dziedziczenie i mutacja długości życia.

---

## 2. Szczegółowe Wymagania Funkcjonalne

### 2.1. Środowisko i Parametry Symulacji
**Wymagania:**
1.  **Świat 2D**: Plansza w formie siatki (krata). Rozmiar konfigurowalny (np. X * Y pól).
2.  **Czas**: Symulacja odbywa się w turach (krokach czasowych).
3.  **Zarządzanie Parametrami**: Użytkownik musi mieć możliwość edycji parametrów przed startem lub w trakcie symulacji:
    - Rozmiar planszy.
    - Szybkość symulacji (kroki na sekundę, pauza).
    - Początkowa liczebność populacji.
    - Ilość startowa energii agentów.
    - Koszt energetyczny ruchu/tury.
    - Zysk energii z jedzenia/walki.
    - Częstotliwość pojawiania się jedzenia i trucizn.

### 2.2. Agenci (Ludziki)
Każdy agent posiada stan i cechy:
1.  **Energia**:
    - Agent startuje z określoną energią.
    - Każda tura i każdy ruch kosztuje energię.
    - Spadek energii do 0 oznacza śmierć (usunięcie z planszy).
2.  **Płeć**: Losowa lub determinowana, kluczowa dla interakcji (walka vs rozmnażanie).
3.  **Wiek**: Licznik przeżytych tur (Etap 4).
4.  **Wzrok**: Agent widzi tylko 8 sąsiednich pól (Moore neighborhood).

### 2.3. System DNA i Podejmowanie Decyzji
1.  **Struktura DNA**: Lista priorytetów decydująca o kierunku ruchu w zależności od zawartości sąsiedniego pola.
    - Przykład: Czy agent woli wejść na pole z jedzeniem, czy na pole z partnerem? Czy unika trucizny, czy jest mu obojętna?
    - DNA jest losowe dla pierwszej generacji.
2.  **Decyzja o Ruchu**:
    - W każdej turze agent sprawdza otoczenie.
    - Wybiera pole docelowe na podstawie swojego DNA (listy priorytetów).

### 2.4. Interakcje
Zasady kolizji, gdy agent wchodzi na pole:
1.  **Puste pole**: Agent przesuwa się, traci standardową ilość energii.
2.  **Jedzenie (Owoc)**: Agent zjada owoc, zyskuje dużą ilość energii, owoc znika.
3.  **Trucizna**: Agent traci znaczną ilość energii (lub ginie natychmiastowo).
4.  **Inny Agent (Ta sama płeć)**:
    - **Pojedynek**: Porównanie poziomu energii.
    - Wygrywa ten z wyższą energią.
    - Wygrywający przejmuje energię przegranego (zjada go).
    - Przegrany ginie.
5.  **Inny Agent (Przeciwna płeć)**:
    - **Rozmnażanie**: Powstaje nowy osobnik na wolnym polu w pobliżu.
    - **Bilans energetyczny**: OBOJE rodzice tracą `repro_energy_cost` energii. Potomek otrzymuje sumę energii od obojga rodziców (2 * `repro_energy_cost`).
    - **Zachowanie energii**: Energia nie jest tworzona ani niszczona - potomek otrzymuje dokładnie tyle energii, ile rodzice łącznie stracili.
    - Rozmnażanie jest możliwe tylko gdy OBA osobniki mają energię > `repro_energy_cost`.

### 2.5. Rozmnażanie i Dziedziczenie
1.  **Mieszanie genów**: Potomek dziedziczy DNA po rodzicach (np. 50% priorytetów od matki, 50% od ojca).
2.  **Mutacje**: Szansa na losową zmianę w DNA.
3.  **Starzenie (Etap 4)**:
    - Nowo narodzony agent dziedziczy maksymalną długość życia.
    - Może wystąpić mutacja skracająca lub wydłużająca życie (w opisie: "stopniowe skracanie").

### 2.6. UI i Wizualizacja
1.  **Widok Planszy**: Graficzna reprezentacja siatki.
    - Odróżnienie płci agentów (kolory/kształty).
    - Wizualizacja jedzenia i trucizn.
2.  **Panel Statystyk (Etap 3)**:
    - Aktualna liczebność populacji.
    - Statystyki DNA (jakie strategie dominują w populacji).
    - Wykresy zmian w czasie.

## 3. Stos Technologiczny (Zaktualizowany)

### 3.1. Architektura Systemu
- **Model (Silnik Symulacji)**:
    - Język: **Rust** (kompilowany do WebAssembly).
    - Rola: Oblicza całą logikę tury, zarządza pamięcią, przetwarza interakcje agentów.
    - Uzasadnienie: Maksymalna wydajność, brak narzutu Garbage Collectora, możliwość symulowania milionów kroków w rozsądnym czasie.
- **Controller (Warstwa Pośrednia)**:
    - Technologia: **Web Workers**.
    - Rola: Uruchamia silnik Wasm w oddzielnym wątku, aby nie blokować UI.
- **View (Warstwa Prezentacji)**:
    - Technologia: **TypeScript + HTML5 Canvas**.
    - Rola: Renderuje stan otrzymany od Workera, obsługuje interakcję z użytkownikiem (kliknięcia, zmiana parametrów).

### 3.2. Zarządzanie Projektem i Deployment
- **Bundler**: Vite (świetne wsparcie dla Wasm i Workerów).
- **Języki**: TypeScript (Frontend), Rust (Core).
- **Deployment**: **GitHub Pages** (aplikacja w pełni Client-Side, statyczna).
- **CI/CD**: GitHub Actions (automatyczna kompilacja Rusta i build frontendu przy pushu).
