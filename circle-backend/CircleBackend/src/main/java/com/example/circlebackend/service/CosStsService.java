package com.example.circlebackend.service;

import com.example.circlebackend.vo.StsResponse;

public interface CosStsService {
    StsResponse getStsCredential() throws Exception;


    boolean deleteFile(String fileUrl);
}