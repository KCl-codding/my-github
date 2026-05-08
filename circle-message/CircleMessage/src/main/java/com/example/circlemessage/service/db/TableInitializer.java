package com.example.circlemessage.service.db;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

/**
 * 应用启动时自动创建消息表
 */
@Component
public class TableInitializer implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(TableInitializer.class);

    @Autowired
    private MessageTableManager tableManager;

    @Override
    public void run(String... args) throws Exception {
        log.info("========================================");
        log.info("🚀 开始初始化消息表...");
        log.info("========================================");

        // 创建未来2年的所有消息表
        // 当前是2026年4月 → 创建 2026年上下半年 + 2027年上下半年 + 2028年上下半年
        tableManager.createFutureTables(2);

        log.info("========================================");
        log.info("✅ 消息表初始化完成");
        log.info("========================================");

        // 打印所有已存在的消息表
        log.info("📋 当前所有消息表: {}", tableManager.getAllMessageTables());
    }
}