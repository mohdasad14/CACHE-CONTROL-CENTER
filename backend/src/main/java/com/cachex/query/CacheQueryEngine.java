package com.cachex.query;

import java.util.*;
import java.util.function.Predicate;
import java.util.stream.Collectors;

/**
 * In-Memory Predicate and SQL-Style Query Engine for Cache Entities.
 *
 * Executes filtering, projections, and sorting across in-memory cache models.
 */
public class CacheQueryEngine<T> {

    public static class QueryBuilder<T> {
        private Predicate<T> filterPredicate = t -> true;
        private Comparator<T> sortComparator = null;
        private int limitCount = Integer.MAX_VALUE;
        private int offsetCount = 0;

        public QueryBuilder<T> where(Predicate<T> predicate) {
            this.filterPredicate = this.filterPredicate.and(predicate);
            return this;
        }

        public QueryBuilder<T> orderBy(Comparator<T> comparator) {
            this.sortComparator = comparator;
            return this;
        }

        public QueryBuilder<T> limit(int count) {
            this.limitCount = count;
            return this;
        }

        public QueryBuilder<T> offset(int count) {
            this.offsetCount = count;
            return this;
        }

        public List<T> execute(Collection<T> dataset) {
            if (dataset == null || dataset.isEmpty()) {
                return Collections.emptyList();
            }

            var stream = dataset.stream().filter(filterPredicate);

            if (sortComparator != null) {
                stream = stream.sorted(sortComparator);
            }

            return stream.skip(offsetCount).limit(limitCount).collect(Collectors.toList());
        }
    }

    public static <T> QueryBuilder<T> create() {
        return new QueryBuilder<>();
    }
}
