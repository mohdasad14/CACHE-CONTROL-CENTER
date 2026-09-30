package com.cachex;

import com.cachex.spring.CacheXCacheManager;
import com.cachex.spring.example.UserService;
import com.cachex.spring.example.UserService.UserProfile;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.cache.Cache;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("Spring Framework @Cacheable Integration Tests")
class SpringCacheIntegrationTest {

    @Test
    @DisplayName("Should successfully cache, retrieve, and evict entities via Spring Cache interface")
    void testSpringCacheAbstraction() {
        CacheXCacheManager springCacheManager = new CacheXCacheManager();
        Cache userCache = springCacheManager.getCache("users");

        assertNotNull(userCache);
        assertEquals("users", userCache.getName());

        // Put entity
        UserProfile profile = new UserProfile("usr-101", "Alice Chen", "alice@example.com", "ENGINEERING");
        userCache.put("usr-101", profile);

        // Retrieve with ValueWrapper
        Cache.ValueWrapper wrapper = userCache.get("usr-101");
        assertNotNull(wrapper);
        assertEquals(profile, wrapper.get());

        // Evict
        userCache.evict("usr-101");
        assertNull(userCache.get("usr-101"));
    }

    @Test
    @DisplayName("Should support @Cacheable valueLoader callable semantics (cache miss resolution)")
    void testValueLoaderCallable() {
        CacheXCacheManager springCacheManager = new CacheXCacheManager();
        Cache cache = springCacheManager.getCache("computed");

        String computed = cache.get("expensive-key", () -> {
            // Emulate slow DB execution
            return "computed-result-42";
        });

        assertEquals("computed-result-42", computed);

        // Second fetch should return cached result without invoking loader again
        String fromCache = cache.get("expensive-key", () -> {
            fail("Loader callable should NOT be invoked on cache hit");
            return "fail";
        });

        assertEquals("computed-result-42", fromCache);
    }
}
