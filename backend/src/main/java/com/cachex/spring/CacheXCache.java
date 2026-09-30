package com.cachex.spring;

import com.cachex.core.CacheManager;
import java.util.concurrent.Callable;
import org.springframework.cache.Cache;
import org.springframework.cache.support.SimpleValueWrapper;

/**
 * Spring Cache abstraction adapter for CacheX.
 * Allows seamless drop-in integration with Spring's declarative caching annotations:
 * {@code @Cacheable}, {@code @CachePut}, and {@code @CacheEvict}.
 */
public class CacheXCache implements Cache {

    private final String name;
    private final CacheManager<Object, Object> delegate;

    public CacheXCache(String name, CacheManager<Object, Object> delegate) {
        this.name = name;
        this.delegate = delegate;
    }

    @Override
    public String getName() {
        return this.name;
    }

    @Override
    public Object getNativeCache() {
        return this.delegate;
    }

    @Override
    public ValueWrapper get(Object key) {
        Object value = delegate.get(key);
        return (value != null) ? new SimpleValueWrapper(value) : null;
    }

    @SuppressWarnings("unchecked")
    @Override
    public <T> T get(Object key, Class<T> type) {
        Object value = delegate.get(key);
        if (value != null && type != null && !type.isInstance(value)) {
            throw new IllegalStateException(
                "Cached value is not of required type [" + type.getName() + "]: " + value
            );
        }
        return (T) value;
    }

    @SuppressWarnings("unchecked")
    @Override
    public <T> T get(Object key, Callable<T> valueLoader) {
        Object value = delegate.get(key);
        if (value != null) {
            return (T) value;
        }

        synchronized (delegate) {
            value = delegate.get(key);
            if (value != null) {
                return (T) value;
            }
            try {
                T loaded = valueLoader.call();
                delegate.put(key, loaded);
                return loaded;
            } catch (Exception ex) {
                throw new ValueRetrievalException(key, valueLoader, ex);
            }
        }
    }

    @Override
    public void put(Object key, Object value) {
        delegate.put(key, value);
    }

    @Override
    public ValueWrapper putIfAbsent(Object key, Object value) {
        Object existing = delegate.get(key);
        if (existing == null) {
            delegate.put(key, value);
            return null;
        }
        return new SimpleValueWrapper(existing);
    }

    @Override
    public void evict(Object key) {
        delegate.remove(key);
    }

    @Override
    public void clear() {
        delegate.clear();
    }
}
