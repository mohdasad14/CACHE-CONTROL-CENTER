# CacheX — Java 17+ Spring Boot In-Memory Cache Service

High-performance, thread-safe in-memory caching engine with pluggable LRU & LFU eviction policies, independent per-entry TTL, concurrent read-write locks, and real-time REST metrics API.

---

## Requirements
- Java 17 or higher (`openjdk-17-jdk` or `temurin-17`)
- Apache Maven 3.8+ (or use `./mvnw`)

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

### 3. Build Executable JAR
```bash
mvn clean package -DskipTests
java -jar target/cachex-concurrent-cache-1.0.0.jar
```

---

## REST API Specification

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/cache/health` | Health probe & version info |
| `GET` | `/api/cache/metrics` | Real-time hits, misses, hit rate, evictions, latency |
| `GET` | `/api/cache/entries` | List of cached keys, values, remaining TTL, access count |
| `POST` | `/api/cache/entry` | Put new key-value pair (`{ "key": "k", "value": "v", "ttlMillis": 60000 }`) |
| `GET` | `/api/cache/entry/{key}` | Lookup entry by key |
| `DELETE` | `/api/cache/entry/{key}` | Invalidate entry by key |
| `POST` | `/api/cache/policy` | Select eviction policy (`{ "policy": "LRU" }` or `"LFU"`) |
| `POST` | `/api/cache/capacity` | Change cache capacity (`{ "capacity": 15 }`) |
| `POST` | `/api/cache/reset` | Reset all performance counters to zero |
| `POST` | `/api/cache/clear` | Purge all in-memory entries |
| `POST` | `/api/cache/simulate` | Run access pattern workload (`hotspot`, `cyclic`, `zipfian`, `scan`) |
| `POST` | `/api/cache/stress-test`| Execute concurrent multithreaded benchmark |

---

## Architectural Highlights

1. **Strict $O(1)$ Time Complexity**:
   - **LRU Policy**: Doubly-Linked List with sentinel head/tail nodes and HashMap index.
   - **LFU Policy**: Frequency buckets indexed with LinkedHashSets and an active `minFrequency` pointer.
2. **Fine-Grained Concurrency**:
   - `java.util.concurrent.ConcurrentHashMap` for lock-free read lookups.
   - `java.util.concurrent.locks.ReentrantReadWriteLock` for atomic eviction and state updates.
3. **Independent TTL Expiration**:
   - Lazy expiration on `get()` prevents stale read leaks.
   - Active `ScheduledExecutorService` background cleaner daemon purges dead entries periodically.
