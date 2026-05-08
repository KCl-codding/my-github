package com.example.circlebackend.exception;

public class UserException extends BusinessException {
    public UserException(ResultCode resultCode) {
        super(resultCode.getCode(), resultCode.getMessage());
    }

    public UserException(ResultCode resultCode, String extraMessage) {
        super(resultCode.getCode(), resultCode.getMessage() + ": " + extraMessage);
    }

    public UserException(ResultCode resultCode, Throwable cause) {
        super(resultCode.getCode(), resultCode.getMessage(), cause);
    }
}