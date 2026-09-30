package com.cachex.core;

import com.cachex.model.EvictionPolicyType;
import java.util.*;

/**
 * Least Frequently Used (LFU) Eviction Policy.
 * Implements strict O(1) frequency tiering with LRU tie-breaking using
 * frequency-indexed LinkedHashSets and an active minFrequency pointer.
 */
public class LFUPolicy<K> implements EvictionPolicy<K> {

    private final Map<K, Integer> keyFrequencyMap = new HashMap<>();
    private final Map<Integer, LinkedHashSet<K>> frequencyBucketMap = new HashMap<>();
    private int minFrequency = 0;

    @Override
    public EvictionPolicyType getType() {
        return EvictionPolicyType.LFU;
    }

    @Override
    public synchronized void recordAccess(K key) {
        Integer currentFreq = keyFrequencyMap.get(key);
        if (currentFreq == null) {
            recordAdd(key);
            return;
        }

        int newFreq = currentFreq + 1;
        keyFrequencyMap.put(key, newFreq);

        // Remove from current frequency bucket
        LinkedHashSet<K> currentBucket = frequencyBucketMap.get(currentFreq);
        if (currentBucket != null) {
            currentBucket.remove(key);
            if (currentBucket.isEmpty()) {
                frequencyBucketMap.remove(currentFreq);
                if (minFrequency == currentFreq) {
                    minFrequency = newFreq;
                }
            }
        }

        // Add to new frequency bucket
        frequencyBucketMap.computeIfAbsent(newFreq, f -> new LinkedHashSet<>()).add(key);
    }

    @Override
    public synchronized void recordAdd(K key) {
        if (keyFrequencyMap.containsKey(key)) {
            recordAccess(key);
            return;
        }

        keyFrequencyMap.put(key, 1);
        frequencyBucketMap.computeIfAbsent(1, f -> new LinkedHashSet<>()).add(key);
        minFrequency = 1;
    }

    @Override
    public synchronized void recordRemove(K key) {
        Integer freq = keyFrequencyMap.remove(key);
        if (freq != null) {
            LinkedHashSet<K> bucket = frequencyBucketMap.get(freq);
            if (bucket != null) {
                bucket.remove(key);
                if (bucket.isEmpty()) {
                    frequencyBucketMap.remove(freq);
                    if (minFrequency == freq) {
                        recalculateMinFrequency();
                    }
                }
            }
        }
    }

    @Override
    public synchronized K getEvictionCandidate() {
        if (keyFrequencyMap.isEmpty()) {
            return null;
        }
        LinkedHashSet<K> minBucket = frequencyBucketMap.get(minFrequency);
        if (minBucket == null || minBucket.isEmpty()) {
            recalculateMinFrequency();
            minBucket = frequencyBucketMap.get(minFrequency);
        }
        if (minBucket != null && !minBucket.isEmpty()) {
            // First item in LinkedHashSet is the oldest added to this tier (LRU tie-break)
            return minBucket.iterator().next();
        }
        return null;
    }

    @Override
    public synchronized void clear() {
        keyFrequencyMap.clear();
        frequencyBucketMap.clear();
        minFrequency = 0;
    }

    @Override
    public synchronized List<K> getOrder() {
        List<K> list = new ArrayList<>();
        List<Integer> sortedFrequencies = new ArrayList<>(frequencyBucketMap.keySet());
        Collections.sort(sortedFrequencies, Collections.reverseOrder());
        for (Integer freq : sortedFrequencies) {
            LinkedHashSet<K> bucket = frequencyBucketMap.get(freq);
            if (bucket != null) {
                list.addAll(bucket);
            }
        }
        return list;
    }

    private void recalculateMinFrequency() {
        if (frequencyBucketMap.isEmpty()) {
            minFrequency = 0;
            return;
        }
        minFrequency = Collections.min(frequencyBucketMap.keySet());
    }
}
