package com.cachex.aspect;

import com.cachex.core.CacheManager;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.stereotype.Component;

import java.lang.annotation.*;
import java.util.Arrays;

/**
 * Spring AOP Aspect providing declarative caching annotations:
 * - @CacheXable: Retrieves from cache or invokes underlying service method.
 * - @CacheXPut: Always invokes method and updates cache with return value.
 * - @CacheXEvict: Evicts specified key from cache.
 */
@Aspect
@Component
public class CacheXAspect {

    @Target(ElementType.METHOD)
    @Retention(RetentionPolicy.RUNTIME)
    public @interface CacheXable {
        String key() default "";
        long ttlMillis() default 0;
    }

    @Target(ElementType.METHOD)
    @Retention(RetentionPolicy.RUNTIME)
    public @interface CacheXPut {
        String key() default "";
        long ttlMillis() default 0;
    }

    @Target(ElementType.METHOD)
    @Retention(RetentionPolicy.RUNTIME)
    public @interface CacheXEvict {
        String key() default "";
    }

    private final CacheManager<String, Object> cacheManager;

    public CacheXAspect(CacheManager<String, Object> cacheManager) {
        this.cacheManager = cacheManager;
    }

    @Around("@annotation(cacheable)")
    public Object aroundCacheable(ProceedingJoinPoint pjp, CacheXable cacheable) throws Throwable {
        String cacheKey = resolveKey(pjp, cacheable.key());
        Object cachedValue = cacheManager.get(cacheKey);

        if (cachedValue != null) {
            return cachedValue;
        }

        // Cache miss -> proceed with target method execution
        Object result = pjp.proceed();
        if (result != null) {
            cacheManager.put(cacheKey, result, cacheable.ttlMillis());
        }
        return result;
    }

    @Around("@annotation(cachePut)")
    public Object aroundCachePut(ProceedingJoinPoint pjp, CacheXPut cachePut) throws Throwable {
        Object result = pjp.proceed();
        if (result != null) {
            String cacheKey = resolveKey(pjp, cachePut.key());
            cacheManager.put(cacheKey, result, cachePut.ttlMillis());
        }
        return result;
    }

    @Around("@annotation(cacheEvict)")
    public Object aroundCacheEvict(ProceedingJoinPoint pjp, CacheXEvict cacheEvict) throws Throwable {
        String cacheKey = resolveKey(pjp, cacheEvict.key());
        cacheManager.delete(cacheKey);
        return pjp.proceed();
    }

    private String resolveKey(ProceedingJoinPoint pjp, String customKey) {
        if (customKey != null && !customKey.trim().isEmpty()) {
            return customKey;
        }
        String className = pjp.getTarget().getClass().getSimpleName();
        String methodName = pjp.getSignature().getName();
        String args = Arrays.deepToString(pjp.getArgs());
        return className + ":" + methodName + ":" + args;
    }
}
