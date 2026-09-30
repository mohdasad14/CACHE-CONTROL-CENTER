package com.cachex;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class CacheApplication {

    public static void main(String[] args) {
        SpringApplication.run(CacheApplication.class, args);
        System.out.println("==================================================================");
        System.out.println("   CacheX Java In-Memory Cache Service Started on Port 8080");
        System.out.println("   Endpoints: http://localhost:8080/api/cache/metrics");
        System.out.println("   Actuator:  http://localhost:8080/actuator/health");
        System.out.println("==================================================================");
    }
}
