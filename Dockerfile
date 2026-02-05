# ==========================================
# Dockerfile для Fire Snake Game (Web Version)
# Multi-stage build: сборка + запуск
# ==========================================

# ==========================================
# STAGE 1: Сборка приложения
# ==========================================
FROM maven:3.9-eclipse-temurin-21 AS builder

WORKDIR /app

# Копируем файл зависимостей для кэширования
COPY pom.xml .

# Загружаем зависимости
RUN mvn dependency:go-offline -B

# Копируем исходный код
COPY src ./src

# Собираем JAR-файл
RUN mvn clean package -DskipTests -B

# ==========================================
# STAGE 2: Финальный образ для запуска
# ==========================================
FROM eclipse-temurin:21-jre

LABEL maintainer="Fire Snake Project"
LABEL version="1.0.0"
LABEL description="Fire Snake - Web-based Snake game with shooting mechanics"

WORKDIR /app

# Копируем собранный JAR
COPY --from=builder /app/target/fire-snake-game-1.0.0.jar ./fire-snake-game.jar

# Создаём непривилегированного пользователя
RUN groupadd -r firesnake && useradd -r -g firesnake firesnake
RUN chown -R firesnake:firesnake /app
USER firesnake

# Открываем порт 5050
EXPOSE 5050

# Запускаем приложение
ENTRYPOINT ["java", "-jar", "fire-snake-game.jar"]
