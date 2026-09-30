#!/usr/bin/env bash
# CacheX Java Backend Runner
set -e

echo "Starting CacheX Java Spring Boot Backend..."
if command -v mvn &> /dev/null; then
    mvn clean spring-boot:run
elif [ -f "./mvnw" ]; then
    ./mvnw clean spring-boot:run
else
    echo "Error: Maven (mvn) or mvnw not found. Please install Maven or Java 17+."
    exit 1
fi
