package com.example.circlemessage.config;

import java.time.LocalDateTime;

/**
 * 动态表名上下文 - 传递当前操作的时间
 */
public class DynamicTableContext {
    private static final ThreadLocal<LocalDateTime> TIME_HOLDER = new ThreadLocal<>();

    public static void setTime(LocalDateTime time) {
        TIME_HOLDER.set(time);
    }

    public static LocalDateTime getTime() {
        return TIME_HOLDER.get();
    }

    public static void clear() {
        TIME_HOLDER.remove();
    }
}