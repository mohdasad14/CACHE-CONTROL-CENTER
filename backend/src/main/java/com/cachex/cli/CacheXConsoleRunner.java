package com.cachex.cli;

import com.cachex.core.CacheManager;
import com.cachex.model.EvictionPolicyType;
import java.util.Scanner;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

/**
 * Interactive Console CLI for CacheX.
 * Enables direct terminal interaction and debugging when running standalone.
 */
@Component
public class CacheXConsoleRunner implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(CacheXConsoleRunner.class);
    private final CacheManager<String, String> cacheManager;

    @SuppressWarnings("unchecked")
    public CacheXConsoleRunner(CacheManager<?, ?> cacheManager) {
        this.cacheManager = (CacheManager<String, String>) cacheManager;
    }

    @Override
    public void run(String... args) throws Exception {
        log.info("==================================================================");
        log.info("  CacheX Enterprise Java Cache Engine Initialized");
        log.info("  Active Policy: {} | Capacity: {}", cacheManager.getEvictionPolicyType(), cacheManager.getCapacity());
        log.info("  Available Strategies: LRU, LFU, FIFO, TWO_QUEUE (2Q), ARC, RANDOM");
        log.info("  REST API & Live Telemetry Server listening on port 8080");
        log.info("==================================================================");

        // Check if interactive console mode was requested via --console
        for (String arg : args) {
            if ("--console".equalsIgnoreCase(arg)) {
                startInteractiveShell();
                break;
            }
        }
    }

    private void startInteractiveShell() {
        new Thread(() -> {
            Scanner scanner = new Scanner(System.in);
            System.out.println("CacheX Interactive Shell started. Type 'help' for commands.");
            while (true) {
                System.out.print("cachex> ");
                if (!scanner.hasNextLine()) break;
                String line = scanner.nextLine().trim();
                if (line.equalsIgnoreCase("exit") || line.equalsIgnoreCase("quit")) break;
                handleCommand(line);
            }
        }, "CacheX-CLI-Thread").start();
    }

    private void handleCommand(String line) {
        String[] parts = line.split("\\s+");
        if (parts.length == 0 || parts[0].isEmpty()) return;

        switch (parts[0].toLowerCase()) {
            case "put":
                if (parts.length >= 3) {
                    cacheManager.put(parts[1], parts[2]);
                    System.out.println("OK: Stored " + parts[1]);
                } else {
                    System.out.println("Usage: put <key> <val>");
                }
                break;
            case "get":
                if (parts.length >= 2) {
                    String val = cacheManager.get(parts[1]);
                    System.out.println(val != null ? ("HIT: " + val) : "MISS");
                } else {
                    System.out.println("Usage: get <key>");
                }
                break;
            case "stats":
                System.out.println("Size: " + cacheManager.size() + "/" + cacheManager.getCapacity());
                System.out.println("Hits: " + cacheManager.getMetrics().getHits() +
                                   ", Misses: " + cacheManager.getMetrics().getMisses());
                System.out.printf("Hit Rate: %.2f%%\n", cacheManager.getMetrics().getHitRate() * 100.0);
                break;
            case "help":
                System.out.println("Commands: put <k> <v>, get <k>, stats, clear, exit");
                break;
            case "clear":
                cacheManager.clear();
                System.out.println("Cache cleared.");
                break;
            default:
                System.out.println("Unknown command: " + parts[0]);
        }
    }
}
