package com.example.circlemessage.utils;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * 消息表名工具类
 * 按6个月分表，表名格式：messages_YYYYMM (月份为01或07)
 */
public class MessageTableUtil {

    /**
     * 根据时间获取表名
     * 2026-01-15 → messages_202601
     * 2026-07-20 → messages_202607
     */
    public static String getTableName(LocalDateTime time) {
        int year = time.getYear();
        int month = time.getMonthValue();

        // 1-6月用01，7-12月用07
        String suffix = month <= 6 ? "01" : "07";
        return "messages_" + year + suffix;
    }

    /**
     * 获取当前时间对应的表名
     */
    public static String getCurrentTableName() {
        return getTableName(LocalDateTime.now());
    }

    /**
     * 获取下一个周期的表名
     * 当前是2026年1-6月 → 返回 messages_202607
     * 当前是2026年7-12月 → 返回 messages_202701
     */
    public static String getNextTableName() {
        LocalDateTime now = LocalDateTime.now();
        if (now.getMonthValue() <= 6) {
            return "messages_" + now.getYear() + "07";
        } else {
            return "messages_" + (now.getYear() + 1) + "01";
        }
    }

    /**
     * 获取指定年份和周期的表名
     * @param year 年份
     * @param period 1:上半年, 7:下半年
     */
    public static String getTableName(int year, int period) {
        if (period != 1 && period != 7) {
            throw new IllegalArgumentException("period 必须是 1 或 7");
        }
        return "messages_" + year + String.format("%02d", period);
    }

    /**
     * 获取未来N年的所有表名
     * @param years 未来几年
     */
    public static List<String> getFutureTableNames(int years) {
        List<String> tables = new ArrayList<>();
        int currentYear = LocalDateTime.now().getYear();
        int currentPeriod = LocalDateTime.now().getMonthValue() <= 6 ? 1 : 7;

        for (int i = 0; i < years * 2; i++) {
            int year = currentYear;
            int period = currentPeriod + i * 6;

            while (period > 12) {
                period -= 12;
                year++;
            }

            tables.add(getTableName(year, period));
        }

        return tables;
    }
}