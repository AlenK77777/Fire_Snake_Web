# Fire Snake Game — Web Version

A browser-based Snake game with shooting mechanics, built with Spring Boot (Java) and vanilla JavaScript. This project is designed as a **test application for QA engineers and SDETs** (Software Developers in Test) to practice and demonstrate testing skills in a realistic, interactive environment.

---

## Why This Game Is for QA Engineers and SDETs

### Purpose of This Test Application

Fire Snake is not only a playable game; it is **intentionally built as a test target** for people who work in quality assurance and test automation:

- **QA Engineers** can use it to practice manual and exploratory testing: UI behavior, edge cases, regression, cross-browser checks, and writing bug reports with clear steps and expected vs actual results.
- **SDETs** (Software Developers in Test) can use it to practice automation: API testing (REST), end-to-end tests (e.g. Selenium/Playwright), CI/CD pipelines (Jenkins), containerization (Docker), and using structured logs for test evidence and debugging.

The application combines:

- A **backend** (Spring Boot, REST API, file-based session logging)
- A **frontend** (HTML5 Canvas, JavaScript, dynamic UI and game state)
- **Build and deployment** (Maven, Jenkins, Docker)

So testers can work on **full-stack testing**: backend APIs, frontend behavior, deployment, and observability (logs), in one small but complete system.

### Why This Game Is Ideal for Testing Practice

1. **Rich, deterministic behavior**  
   The game has clear rules: movement, collision, scoring, lives, power-ups, enemies. You can define expected outcomes and write test cases (manual or automated) against them.

2. **Observable state**  
   Score, length, lives, high score, and targets hit are visible in the UI and can be correlated with **session logs** (see [Logs](#logs)) for test evidence and debugging.

3. **API surface**  
   The `/api/log` endpoint allows testing REST APIs (payload validation, status codes, side effects on the `logs/` directory). Future endpoints could extend this for more API testing.

4. **Reproducible environment**  
   You can run the same version in a JAR, in Docker, or in Jenkins. That makes it easy to practice **environment parity** and **CI/CD testing**.

5. **Real-world stack**  
   Java, Maven, Spring Boot, Jenkins, and Docker are widely used in industry. Practicing on this project translates directly to real QA/SDET workflows.

6. **Controlled complexity**  
   The codebase is small enough to understand end-to-end, but complex enough to justify test plans, test cases, and automation (e.g. “food is eaten one circle at a time”, “enemy spawns after N frames”, “game over when lives = 0”).

---

## Project Structure and Key Files

### `pom.xml` (Maven / POM File)

**What it is:**  
The Project Object Model (POM) is Maven’s configuration file. It defines how the project is built, what it depends on, and what artifacts it produces.

**Why it matters for testing:**

- **Build reproducibility:** `mvn clean package` produces the same JAR (e.g. `fire-snake-game-1.0.0.jar`) from the same source. Test environments can rely on a single artifact.
- **Dependencies:** All libraries (e.g. Spring Boot, Thymeleaf) are declared in the POM. Dependency and security scans (e.g. OWASP) can be run against this file and the resolved dependencies.
- **Lifecycle and plugins:**  
  - `mvn compile` — compile Java and copy resources (e.g. `game.js`) to `target/classes`.  
  - `mvn test` — run unit tests (e.g. JUnit). Jenkins can run this step and publish test reports.  
  - `mvn package` — build the executable JAR.  
  So testers can align test types (unit, integration, E2E) with these phases.

**Relevant content:**

- **Parent:** `spring-boot-starter-parent` (version 3.2.0).  
- **Artifact:** `fire-snake-game`, version `1.0.0`, packaging `jar`.  
- **Main class:** `com.firesnake.FireSnakeApplication` (configured in `spring-boot-maven-plugin`).  
- **Dependencies:** `spring-boot-starter-web`, `spring-boot-starter-thymeleaf`.

Understanding the POM helps you know **what** is being built and **how** to trigger builds from Jenkins or the command line.

---

### Jenkinsfile(s) (CI/CD Pipeline)

**What they are:**  
Jenkins pipeline definitions. They describe the **stages** of the build (checkout, compile, test, package, optional Docker build/push) and run on a Jenkins agent (e.g. Windows with `bat`).

**Why they matter for testing:**

- **Automated build and test:** Every commit (or scheduled run) can trigger a full build and test. Failures are visible in Jenkins (e.g. “Тестирование” stage failed).
- **Artifacts:** The built JAR is archived. Testers (or later stages) can download the same JAR and run smoke/E2E tests against it.
- **Consistency:** The same commands (`mvn clean`, `mvn test`, `mvn package`) are run in CI as locally, reducing “works on my machine” issues.

**Files in this repo:**

| File | Purpose |
|------|--------|
| **Jenkinsfile** | Short pipeline: checkout → compile & test → package → build Docker image → push to Docker Hub. Uses `DOCKER_IMAGE` and Docker Hub credentials. |
| **Jenkinsfile_pipeline** | Declarative pipeline with stages: environment check (Java/Maven versions), checkout, clean, compile, **test** (with JUnit report publishing), package, archive JAR. Includes `post` blocks for success/failure/unstable. |
| **Jenkinsfile_node** | Scripted pipeline using `node { }`: same logical stages (checkout, clean, compile, test, package, archive). Uses `bat` for Windows. |

**Typical flow:**

1. **Checkout** — get source from Git.  
2. **Compile** — `mvn compile` (or `mvn clean compile`).  
3. **Test** — `mvn test`; results in `target/surefire-reports/*.xml` can be published in Jenkins (e.g. `junit` step).  
4. **Package** — `mvn package -DskipTests` to produce the JAR.  
5. **Archive** — store `target/*.jar` as build artifacts.  
6. (Optional) **Docker** — build image and push (in the main `Jenkinsfile`).

For QA/SDET: you can **add stages** (e.g. “Deploy to test server”, “Run E2E tests”) or **assert on test results** so the pipeline fails when tests fail.

---

### Dockerfile (Container Image)

**What it is:**  
A multi-stage Docker build that compiles the application and then creates a minimal runtime image.

**Why it matters for testing:**

- **Environment parity:** The game runs the same way on any machine that has Docker: same Java version, same JAR, same port (5050). Test environments (local, Jenkins, cloud) can all use the same image.
- **Isolation:** No need to install Java or Maven on the host; only Docker is required. Useful for CI agents or test runners.
- **Deployment practice:** Mirrors real-world “build once, run anywhere” and supports testing deployment and smoke tests in a container.

**How it works:**

1. **Stage 1 (builder):**  
   - Base image: `maven:3.9-eclipse-temurin-21`.  
   - Copy `pom.xml` → `mvn dependency:go-offline`.  
   - Copy `src/` → `mvn clean package -DskipTests`.  
   - Produces `target/fire-snake-game-1.0.0.jar`.

2. **Stage 2 (runtime):**  
   - Base image: `eclipse-temurin:21-jre` (no Maven).  
   - Copy the JAR from the builder stage.  
   - Create non-root user `firesnake`.  
   - `EXPOSE 5050`.  
   - `ENTRYPOINT ["java", "-jar", "fire-snake-game.jar"]`.

**Running:**

- Build: `docker build -t fire-snake-game .`  
- Run: `docker run -p 5050:5050 fire-snake-game`  
- Open: `http://localhost:5050`

Testers can verify: image builds, container starts, HTTP 200 on `/`, game loads, and (if mounted or copied) that `logs/` appears and gets session logs when playing.

---

### Logs (Session Logging)

**What it is:**  
The application creates a **`logs/`** directory (if missing) and writes **one file per browser session**: `logs/session_<sessionId>.log`. Each line has a **server timestamp** and a **message** sent by the client.

**Why it matters for testing:**

- **Traceability:** You can correlate user actions (keys, game start, food eaten, game over) with timestamps. Useful for bug reports and test evidence.
- **API testing:** The client sends `POST /api/log` with JSON `{ "sessionId", "message" }`. You can test this endpoint (status, body, and that the correct file is created/updated).
- **Observability:** Logs are a simple form of “telemetry” without extra tools. Test automation can read log files to assert on expected events (e.g. “after 5 food eaten, log contains 5 Food eaten lines”).

**How it works:**

1. **Backend**  
   - `FireSnakeApplication` has a `@PostConstruct` method that creates the `logs/` directory at startup.  
   - `GameLogController` exposes `POST /api/log`. It appends to `logs/session_<sessionId>.log` with a line: `yyyy-MM-dd HH:mm:ss.SSS | <message>`.

2. **Frontend**  
   - On load, the game generates a `sessionId` (e.g. `Date.now()`) and defines `logToServer(message)`.  
   - It sends a session-start message (full date/time, “game loaded”).  
   - During play it sends events such as: key presses, game started, food eaten, target destroyed, life lost, respawn, enemy spawned/died, game over, restart.

**Location:**  
Log files are created in the **working directory** of the process (e.g. where you run `java -jar` or where the container runs). For Docker, you can mount a volume to persist logs:  
`docker run -p 5050:5050 -v $(pwd)/logs:/app/logs fire-snake-game`

---

## How the Game Works

### Overview

- **Backend:** Spring Boot serves the main page (`/`) and static assets (JS, CSS). It also provides the `/api/log` endpoint for session logging.
- **Frontend:** A single-page game using HTML5 Canvas. The game loop updates state (snake, food, enemies, bullets, targets) and redraws every frame. Input is handled via keyboard.

### Basic Features

- **Snake:** Moves in a grid (one block per tick). Grows when eating food; dies on wall, self, enemy body, or dangerous targets. Has multiple lives; on death, loses one life and respawns with brief invincibility.
- **Food:** Spawned as Tetris-like shapes made of independent circles. **Only the circle the snake’s head touches is eaten**; the rest of the shape stays. Each circle gives +1 length and +1 score.
- **Shooting:** Space bar fires bullets. Bullets destroy targets (and can hit food, which removes one circle and costs one life). Auto-fire is available.
- **Targets:** Different types (Common, Fast, Rare, Epic, Legendary) with different sizes and hit points. Bigger targets need more hits. Destroying them gives score and length. Some targets apply effects (slow, shrink, speed).
- **Enemy snake:** Spawns periodically (DUMB, MEDIUM, SMART). Moves and shoots at the player. Can be killed by shooting; colliding with it costs a life.
- **Hearts:** Extra-life pickups. Spawn on a timer; disappear after a short time.
- **Lives:** Start with 3 (or more). Game over when lives reach 0.
- **Score & high score:** Persisted in `localStorage`.

### Controls

- **Arrow keys / WASD:** Move. First key press (when in menu) also starts the game.  
- **Space:** Shoot; when game over, restart (after loading screen).  
- **R:** Restart after game over.  
- **M / Backspace:** Mute / unmute sound.  
- **Escape:** Exit (handled as configured).

### Technical Details

- **Port:** 5050 (configurable in `application.properties`).  
- **FPS:** Configurable (e.g. 12 normal); affects game speed and timers.  
- **State:** Game state is held in a `GameState` object and in module-level arrays (snake, foods, bullets, targets, etc.). Session logging does not change game logic; it only sends events to the server.

---

## How to Run

### Prerequisites

- **Java 21** (or use the Docker image, which includes it).  
- **Maven 3.x** (for building from source).  
- **Docker** (optional, for containerized run).

### Build

```bash
mvn clean package -DskipTests
```

Output: `target/fire-snake-game-1.0.0.jar`.

### Run (JAR)

```bash
java -jar target/fire-snake-game-1.0.0.jar
```

Or on Windows:

```bat
run_game.bat
```

Then open: **http://localhost:5050**

### Run (Docker)

```bash
docker build -t fire-snake-game .
docker run -p 5050:5050 fire-snake-game
```

Optional: persist logs:

```bash
docker run -p 5050:5050 -v "$(pwd)/logs:/app/logs" fire-snake-game
```

### Run (development, without repackaging JAR)

```bash
mvn spring-boot:run
```

Static resources are served from `target/classes`; run `mvn compile` after changing JS to see updates.

---

## Summary: Why This Repo Fits QA and SDET

| Aspect | Use for testing |
|--------|------------------|
| **Game logic** | Clear rules → test cases and expected results (manual or automated). |
| **UI (Canvas, DOM)** | E2E tests (e.g. Selenium/Playwright): start game, move, check score/lives. |
| **REST API** | `/api/log` → API tests (payload, status, idempotency, file creation). |
| **Logs** | Evidence, debugging, and simple “event log” assertions. |
| **POM** | Build and dependency management; align test phases with Maven lifecycle. |
| **Jenkins** | CI: build, test, archive JAR; extend with deployment or E2E stages. |
| **Docker** | Reproducible environment; test image build and run. |

Fire Snake gives you a single, small but complete application to practice **manual testing**, **test design**, **automation** (API + UI), **CI/CD**, and **observability** — all in one place, with no need for a large or proprietary codebase.
