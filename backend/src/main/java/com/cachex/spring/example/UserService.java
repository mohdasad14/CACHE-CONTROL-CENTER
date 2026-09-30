package com.cachex.spring.example;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.CachePut;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

/**
 * Enterprise Service demonstrating Spring Cache annotations with CacheX.
 * Showcases declarative cache hits, cache misses, in-place updates, and evictions.
 */
@Service
public class UserService {

    private static final Logger log = LoggerFactory.getLogger(UserService.class);
    private final ConcurrentMap<String, UserProfile> databaseMock = new ConcurrentHashMap<>();

    public UserService() {
        databaseMock.put("usr-101", new UserProfile("usr-101", "Alice Chen", "alice@example.com", "ENGINEERING"));
        databaseMock.put("usr-102", new UserProfile("usr-102", "Bob Martin", "bob@example.com", "PRODUCT"));
        databaseMock.put("usr-103", new UserProfile("usr-103", "Charlie Davis", "charlie@example.com", "DESIGN"));
    }

    /**
     * Cacheable read method. On first call, simulates expensive DB query.
     * Subsequent calls return immediately from CacheX with sub-millisecond latency.
     */
    @Cacheable(value = "users", key = "#userId")
    public UserProfile getUserById(String userId) {
        log.info("CACHE MISS: Executing slow database lookup for userId: {}", userId);
        simulateSlowDatabaseIO(120);
        UserProfile user = databaseMock.get(userId);
        if (user == null) {
            throw new IllegalArgumentException("User not found: " + userId);
        }
        return user;
    }

    /**
     * CachePut updates both the underlying system of record and the CacheX cache.
     */
    @CachePut(value = "users", key = "#user.id")
    public UserProfile updateUser(UserProfile user) {
        log.info("CACHE UPDATE: Writing to DB and refreshing cache for userId: {}", user.getId());
        simulateSlowDatabaseIO(80);
        databaseMock.put(user.getId(), user);
        return user;
    }

    /**
     * CacheEvict invalidates cached entry on deletion or role revocation.
     */
    @CacheEvict(value = "users", key = "#userId")
    public void deleteUser(String userId) {
        log.info("CACHE EVICT: Removing user from DB and CacheX cache for userId: {}", userId);
        databaseMock.remove(userId);
    }

    /**
     * Invalidate entire users cache partition.
     */
    @CacheEvict(value = "users", allEntries = true)
    public void clearAllUserCaches() {
        log.info("CACHE PURGE: Invalidating entire 'users' cache partition in CacheX");
    }

    private void simulateSlowDatabaseIO(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    public static class UserProfile {
        private String id;
        private String name;
        private String email;
        private String department;

        public UserProfile() {}

        public UserProfile(String id, String name, String email, String department) {
            this.id = id;
            this.name = name;
            this.email = email;
            this.department = department;
        }

        public String getId() { return id; }
        public void setId(String id) { this.id = id; }
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public String getEmail() { return email; }
        public void setEmail(String email) { this.email = email; }
        public String getDepartment() { return department; }
        public void setDepartment(String department) { this.department = department; }
    }
}
