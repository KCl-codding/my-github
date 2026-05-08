package com.example.circlebackend.service.yard;

import com.baomidou.mybatisplus.extension.service.IService;
import com.example.circlebackend.entity.yard.Yard;

import java.util.List;

public interface YardService extends IService<Yard> {
    Boolean saveYard(Yard yard);

    List<Yard> getOpenidYards(String openid);
    Yard getUuidYard(String uuid);
    List<Yard> getAllYards();
    List<Yard> getFourYards();
    List<Yard> getFourYardsByType(String type);
}
