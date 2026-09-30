package com.cachex.controller;

import com.cachex.dto.*;
import com.cachex.model.EvictionPolicyType;
import com.cachex.service.AccessPatternSimulationService;
import com.cachex.service.CacheService;
import com.cachex.service.ConcurrencyStressTestService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Collections;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/cache")
@CrossOrigin(origins = "*")
public class CacheController {

    private final CacheService cacheService;
    private final AccessPatternSimulationService simulationService;
    private final ConcurrencyStressTestService stressTestService;

    public CacheController(CacheService cacheService,
                           AccessPatternSimulationService simulationService,
                           ConcurrencyStressTestService stressTestService) {
        this.cacheService = cacheService;
        this.simulationService = simulationService;
        this.stressTestService = stressTestService;
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        return ResponseEntity.ok(Map.of(
                "status", "UP",
                "backend", "Java 17 / Spring Boot 3",
                "version", "1.0.0",
                "timestamp", System.currentTimeMillis()
        ));
    }

    @GetMapping("/metrics")
    public ResponseEntity<CacheMetricsDTO> getMetrics() {
        return ResponseEntity.ok(cacheService.getMetrics());
    }

    @GetMapping("/entries")
    public ResponseEntity<List<CacheEntryDTO>> getEntries() {
        return ResponseEntity.ok(cacheService.getEntries());
    }

    @PostMapping("/entry")
    public ResponseEntity<Map<String, Object>> putEntry(@RequestBody PutEntryRequest request) {
        if (request.getKey() == null || request.getKey().trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Key cannot be empty"));
        }
        cacheService.put(request.getKey().trim(), request.getValue(), request.getTtlMillis());
        return ResponseEntity.ok(Map.of(
                "success", true,
                "key", request.getKey(),
                "ttlMillis", request.getTtlMillis()
        ));
    }

    @GetMapping("/entry/{key}")
    public ResponseEntity<Map<String, Object>> getEntry(@PathVariable String key) {
        String val = cacheService.get(key);
        if (val != null) {
            return ResponseEntity.ok(Map.of(
                    "found", true,
                    "key", key,
                    "value", val
            ));
        } else {
            return ResponseEntity.ok(Map.of(
                    "found", false,
                    "key", key,
                    "message", "Key not found or expired"
            ));
        }
    }

    @DeleteMapping("/entry/{key}")
    public ResponseEntity<Map<String, Object>> deleteEntry(@PathVariable String key) {
        boolean removed = cacheService.remove(key);
        return ResponseEntity.ok(Map.of(
                "success", removed,
                "key", key
        ));
    }

    @PostMapping("/policy")
    public ResponseEntity<Map<String, Object>> setPolicy(@RequestBody Map<String, String> body) {
        String policyStr = body.get("policy");
        if (policyStr == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Policy parameter is required"));
        }
        try {
            EvictionPolicyType type = EvictionPolicyType.valueOf(policyStr.toUpperCase());
            cacheService.setPolicy(type);
            return ResponseEntity.ok(Map.of("success", true, "policy", type.name()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid policy. Must be LRU or LFU"));
        }
    }

    @PostMapping("/capacity")
    public ResponseEntity<Map<String, Object>> setCapacity(@RequestBody Map<String, Integer> body) {
        Integer cap = body.get("capacity");
        if (cap == null || cap <= 0) {
            return ResponseEntity.badRequest().body(Map.of("error", "Capacity must be a positive integer"));
        }
        cacheService.setCapacity(cap);
        return ResponseEntity.ok(Map.of("success", true, "capacity", cap));
    }

    @PostMapping("/reset")
    public ResponseEntity<Map<String, Object>> resetMetrics() {
        cacheService.resetMetrics();
        return ResponseEntity.ok(Map.of("success", true, "message", "Metrics reset to zero"));
    }

    @PostMapping("/clear")
    public ResponseEntity<Map<String, Object>> clearCache() {
        cacheService.clear();
        return ResponseEntity.ok(Map.of("success", true, "message", "Cache cleared"));
    }

    @PostMapping("/simulate")
    public ResponseEntity<SimulationResultDTO> simulate(@RequestBody SimulateRequest request) {
        SimulationResultDTO result = simulationService.runSimulation(request);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/stress-test")
    public ResponseEntity<StressTestResultDTO> stressTest(@RequestBody StressTestRequest request) {
        StressTestResultDTO result = stressTestService.executeStressTest(request);
        return ResponseEntity.ok(result);
    }
}
