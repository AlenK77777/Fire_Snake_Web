package com.firesnake;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@SpringBootApplication
@Controller
public class FireSnakeApplication {

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
