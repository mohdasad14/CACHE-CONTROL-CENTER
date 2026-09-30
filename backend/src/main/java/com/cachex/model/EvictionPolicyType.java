package com.cachex.model;

/**
 * Supported eviction strategies for CacheX.
 */
public enum EvictionPolicyType {
    LRU,
    LFU,
    FIFO,
    TWO_QUEUE,
    ARC,
    RANDOM
}
