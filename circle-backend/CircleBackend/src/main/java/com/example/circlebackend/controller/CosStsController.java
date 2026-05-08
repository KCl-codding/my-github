package com.example.circlebackend.controller;

import com.example.circlebackend.service.CosStsService;
import com.example.circlebackend.vo.StsResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/cos")
public class CosStsController {

    private static final Logger logger = LoggerFactory.getLogger(CosStsController.class);

    @Autowired
    private CosStsService cosStsService;

    @GetMapping("/sts")
    public StsResponse getSts() {
        try {
            return cosStsService.getStsCredential();
        } catch (Exception e) {
            logger.error("获取临时密钥失败", e);
            return StsResponse.error(e.getMessage());
        }
    }
}