package com.firesnake;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

import jakarta.annotation.PostConstruct;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

@SpringBootApplication
@Controller
public class FireSnakeApplication {

    @PostConstruct
    public void ensureLogsDir() {
        try {
            Path logs = Paths.get("logs").toAbsolutePath();
            if (!Files.exists(logs)) {
                Files.createDirectories(logs);
            }
        } catch (Exception ignored) {}
    }

    public static void main(String[] args) {
        SpringApplication.run(FireSnakeApplication.class, args);
        System.out.println("\n" +
            "╔══════════════════════════════════════════════════════════╗\n" +
            "║           FIRE SNAKE GAME                                ║\n" +
            "║   Open your browser: http://localhost:5050               ║\n" +
            "╚══════════════════════════════════════════════════════════╝\n");
    }

    @GetMapping("/")
    public String index() {
        return "index";
    }
}
