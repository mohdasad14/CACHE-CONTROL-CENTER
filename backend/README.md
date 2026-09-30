# CacheX — Enterprise Java 17+ Spring Boot Custom Cache Library

High-performance, thread-safe in-memory caching engine with pluggable eviction policies (**LRU, LFU, FIFO, 2Q, ARC, Random**), Spring Framework `@Cacheable` integration, independent per-entry TTL, concurrent read-write locks, write-behind asynchronous batch persistence, JMX MBeans, and real-time REST metrics API.

---

## Requirements
- Java 17 or higher (`openjdk-17-jdk`, `temurin-17`, or `corretto-17`)
- Apache Maven 3.8+ (or use `./mvnw`)
- Docker (optional, multi-stage `Dockerfile` included)

---

## Quick Start

### 1. Run with Maven
```bash
cd backend
mvn clean spring-boot:run
```

The service will start on port `8080`:
- **Metrics Endpoint**: `GET http://localhost:8080/api/cache/metrics`
- **Cache Entries**: `GET http://localhost:8080/api/cache/entries`
- **Health Check**: `GET http://localhost:8080/api/cache/health`

### 2. Run Tests (JUnit 5 + Concurrency Tests)
```bash
mvn test
```

Includes:
- `CacheManagerTest.java`: Eviction correctness and TTL expiration.
- `TwoQueuePolicyTest.java`: 2Q scan-resistance verification under burst access.
- `ConcurrencyStressTest.java`: 64 threads hammering 32,000 operations concurrently with zero deadlocks.
- `SpringCacheIntegrationTest.java`: `@Cacheable`, `@CachePut`, and `@CacheEvict` contract validation.

### 3. Build Executable JAR & Docker
```bash
mvn clean package -DskipTests
java -jar target/cachex-concurrent-cache-1.0.0.jar

# Or via Docker
docker build -t cachex:1.0.0 .
docker run -p 8080:8080 cachex:1.0.0
```

---

## 6 Pluggable Eviction Strategies

| Policy | Algorithm Class | Key Characteristics |
|---|---|---|
| **LRU** | `LRUPolicy.java` | Strict $O(1)$ Doubly-Linked List with sentinel head/tail nodes and HashMap index |
| **LFU** | `LFUPolicy.java` | Strict $O(1)$ Frequency buckets indexed with LinkedHashSets and dynamic `minFrequency` pointer |
| **2Q (Two-Queue)** | `TwoQueuePolicy.java` | Scan-resistant cache algorithm using probationary FIFO queue ($A1$) and enduring LRU ($Am$) |
| **ARC** | `ARCPolicy.java` | IBM Adaptive Replacement Cache dynamically balancing recency and frequency with ghost lists |
| **FIFO** | `FIFOPolicy.java` | Chronological insertion order queue |
| **RANDOM** | `RandomPolicy.java` | Low-overhead randomized victim selection |

---

## Spring Framework `@Cacheable` Integration

CacheX provides first-class drop-in support for Spring's declarative caching abstraction:

```java
@Configuration
@EnableCaching
public class CacheXConfiguration {
    @Bean
    @Primary
    public CacheManager cacheManager() {
        return new CacheXCacheManager();
    }
}
```

Use in services:
```java
@Service
public class UserService {
    @Cacheable(value = "users", key = "#userId")
    public UserProfile getUserById(String userId) {
        // Automatically cached in CacheX on miss
        return userRepository.findById(userId);
    }
}
```

---

## Architectural Highlights

1. **Lock-Splitting Concurrency**:
   - `java.util.concurrent.ConcurrentHashMap` for lock-free read lookups.
   - `java.util.concurrent.locks.ReentrantReadWriteLock` for atomic eviction and state updates.
2. **Independent TTL Expiration**:
   - Lazy validation on `get()` prevents stale read leaks.
   - Active `ScheduledExecutorService` background cleaner daemon purges dead entries periodically.
3. **Write-Behind Asynchronous Persistence**:
   - `WriteBehindQueue.java` coalesces rapid in-memory writes and flushes batches to backing storage via daemon threads.
4. **JMX & Observability**:
   - `CacheXManagement.java` registers standard MBeans under `com.cachex:type=CacheManager` for JConsole / VisualVM remote monitoring.
