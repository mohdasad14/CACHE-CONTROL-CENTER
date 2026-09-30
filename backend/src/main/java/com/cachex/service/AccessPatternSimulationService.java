package com.cachex.service;

import com.cachex.core.CacheManager;
import com.cachex.dto.SimulateRequest;
import com.cachex.dto.SimulationResultDTO;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class AccessPatternSimulationService {

    private final CacheService cacheService;

    public AccessPatternSimulationService(CacheService cacheService) {
        this.cacheService = cacheService;
    }

    public SimulationResultDTO runSimulation(SimulateRequest request) {
        CacheManager<String, String> cache = cacheService.getCacheManager();
        List<String> sequence = getSequence(request.getPatternName(), request.getCustomSequence(), cache.getCapacity());

        List<String> log = new ArrayList<>();
        long startHits = cache.getMetrics().getHits();
        long startMisses = cache.getMetrics().getMisses();
        long startEvictions = cache.getMetrics().getEvictions();

        for (int i = 0; i < sequence.size(); i++) {
            String key = sequence.get(i);
            String val = cache.get(key);
            if (val != null) {
                log.add(String.format("Step %02d: GET '%s' -> HIT (value='%s')", i + 1, key, val));
            } else {
                String newVal = "sim_val_" + key;
                cache.put(key, newVal, 60000L); // 60s TTL
                log.add(String.format("Step %02d: GET '%s' -> MISS -> PUT '%s'", i + 1, key, newVal));
            }

            if (request.getStepDelayMs() > 0) {
                try {
                    Thread.sleep(request.getStepDelayMs());
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
        }

        long hitsDelta = cache.getMetrics().getHits() - startHits;
        long missesDelta = cache.getMetrics().getMisses() - startMisses;
        long evictionsDelta = cache.getMetrics().getEvictions() - startEvictions;
        long totalOps = hitsDelta + missesDelta;
        double hitRate = totalOps > 0 ? (double) hitsDelta / totalOps * 100.0 : 0.0;

        SimulationResultDTO result = new SimulationResultDTO();
        result.setPatternName(request.getPatternName());
        result.setTotalOperations((int) totalOps);
        result.setHits(hitsDelta);
        result.setMisses(missesDelta);
        result.setEvictions(evictionsDelta);
        result.setHitRate(Math.round(hitRate * 10.0) / 10.0);
        result.setOperationLog(log);

        return result;
    }

    private List<String> getSequence(String patternName, List<String> customSequence, int capacity) {
        if (customSequence != null && !customSequence.isEmpty()) {
            return customSequence;
        }

        String pattern = patternName != null ? patternName.toLowerCase() : "hotspot";
        List<String> seq = new ArrayList<>();

        switch (pattern) {
            case "cyclic":
                // Loop with size = capacity + 1 (worst-case thrashing for LRU)
                for (int loop = 0; loop < 4; loop++) {
                    for (int i = 1; i <= capacity + 2; i++) {
                        seq.add("key_" + i);
                    }
                }
                break;
            case "scan":
                // One-time sequential scan through many unique keys
                for (int i = 1; i <= capacity * 3; i++) {
                    seq.add("scan_item_" + i);
                }
                break;
            case "zipfian":
                // 80/20 rule: 20% of keys accessed 80% of the time
                Random rnd = new Random(42);
                for (int i = 0; i < 30; i++) {
                    if (rnd.nextDouble() < 0.8) {
                        seq.add("hot_key_" + (rnd.nextInt(2) + 1));
                    } else {
                        seq.add("cold_key_" + (rnd.nextInt(15) + 3));
                    }
                }
                break;
            case "hotspot":
            default:
                // Heavy reuse on 3 keys, occasional new keys
                String[] hot = {"user:alice", "user:bob", "session:admin"};
                for (int i = 0; i < 20; i++) {
                    if (i % 3 == 0) {
                        seq.add("temp_page_" + (i / 3));
                    } else {
                        seq.add(hot[i % hot.length]);
                    }
                }
                break;
        }

        return seq;
    }
}
