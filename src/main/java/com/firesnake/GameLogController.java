package com.firesnake;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Map;

/**
 * Receives log entries from the game client and writes them to logs/session_&lt;sessionId&gt;.log.
 * Creates the logs directory automatically if it does not exist.
 */
@RestController
@RequestMapping("/api")
public class GameLogController {

    private static final String LOGS_DIR = "logs";
    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss.SSS");

    @PostMapping("/log")
    public ResponseEntity<Void> log(@RequestBody Map<String, String> body) {
        String sessionId = body != null ? body.get("sessionId") : null;
        String message = body != null ? body.get("message") : null;
        if (sessionId == null || sessionId.isBlank()) sessionId = "unknown";
        if (message == null) message = "";

        try {
            Path logsPath = Paths.get(LOGS_DIR).toAbsolutePath();
            if (!Files.exists(logsPath)) {
                Files.createDirectories(logsPath);
            }
            Path file = logsPath.resolve("session_" + sessionId + ".log");
            String line = FORMATTER.format(LocalDateTime.now()) + " | " + message + "\n";
            Files.write(file, line.getBytes(StandardCharsets.UTF_8), java.nio.file.StandardOpenOption.CREATE, java.nio.file.StandardOpenOption.APPEND);
        } catch (IOException e) {
            // do not fail the request; logging is best-effort
        }
        return ResponseEntity.ok().build();
    }
}
