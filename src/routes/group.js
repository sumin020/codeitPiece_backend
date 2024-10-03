import * as dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import { Prisma } from '@prisma/client';

const groupRouter = express.Router();

function asyncHandler(handler) {
  return async function (req, res) {
    try {
      await handler(req, res);
    } catch (e) {
      if (e.name === 'ValidationError' 
        || e instanceof Prisma.PrismaClientValidationError) {
        res.status(400).send({ message: "잘못된 요청입니다" });
      }
    };
  }
}

groupRouter.route('/')
  //그룹 목록 조회
  .get( asyncHandler (async (req, res) => {
    // 정렬
    const {page = 1, pageSize = 10, sortBy = 'latest', keyword = "", isPublic = true} = req.query;
    const isPublicFilter = isPublic === 'false' ? false : true; //공개 여부

    let orderBy;
    switch (sortBy) {
      case 'mostPosted':
        orderBy = {postCount: 'desc'};
        break;
      case 'mostLiked':
        orderBy = {likeCount: 'desc'};
        break;
      case 'mostBadge':
        orderBy = {badgeCount: 'desc'};
        break;
      case 'latest':
      default:
        orderBy = {createdAt: 'desc'};
    }

    const currentPage = parseInt(page);
    const itemsPerPage = parseInt(pageSize);

    const groups = await req.prisma.group.findMany({
      where : {
        isPublic : isPublicFilter,
        OR: [
          { name: { contains: keyword } }, 
        ],
      },
      orderBy,
      skip: (currentPage - 1) * itemsPerPage,
      take: itemsPerPage,
      select: {
        id: true,
        name: true,
        imageUrl: true,
        isPublic: true,
        likeCount: true,
        badgeCount: true,
        postCount: true,
        createdAt: true,
        introduction: true,
      }
    });
    
    const totalItemCount = await req.prisma.group.count({
      where: {
        isPublic: isPublicFilter,
        OR: [
          { name: { contains: keyword } },
        ],
      },    
    });
    const totalPages = Math.ceil(totalItemCount / pageSize);
    
    const groupResponse = {
      currentPage,
      totalPages,
      totalItemCount,
      data: groups,
    };
  res.status(200).send(groupResponse);
  }))


  //그룹 등록
  .post(asyncHandler(async (req, res) => {
    const newGroup = await req.prisma.group.create({
      data: req.body
    });
    await req.prisma.badge.create({
      data: {
        groupId: newGroup.id,
      }
    })
    const badges = [];
    const { password : gpwd, badgeCount : bct, ...groupWithoutPasswords } = newGroup;
    const groupResponse = {
      ...groupWithoutPasswords, badges
    };
    res.status(201).send(groupResponse);
  }));




groupRouter.route('/:id')
  //그룹 상세 정보 조회
  .get(asyncHandler(async (req, res) => {
    // 비공개 그룹일 경우 조회 권한 확인 api 사용 
    const id = Number(req.params.id);
    const updatedGroup = await req.prisma.group.findUnique({
      where: { id },
      include:{ 
        posts : true 
      },
    })
    const badges = [];
    const badgeData = await req.prisma.badge.findUnique({ where: { groupId : id } });
    for (const key of Object.keys(badgeData)) {
      if (badgeData[key] === true) { // 칼럼 값이 true인지 확인
        badges.push(key); // true인 경우 칼럼 이름을 배열에 추가
      }
    }
    const { password, badgeCount, ...groupWithoutPasswords } = updatedGroup;
    const groupResponse = {...groupWithoutPasswords, badges};
    res.status(200).send(groupResponse);
  }))
 

  //그룹 수정
  .put(asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const group = await req.prisma.group.findUnique({
      where: { id },
    });
    
    //그룹 존재하지 않음 : 404 반환
    if(!group) { 
      return res.status(404).send({"message": "존재하지 않습니다"})
    }

    //그룹 존재 : 비밀번호 맞으면 200, 틀리면 403 반환
    if(req.body.password === group.password){
      const updatedGroup = await req.prisma.group.update({
        where: { id },
        data: req.body,
      });
      const badges = [];
      const badgeData = await req.prisma.badge.findUnique({ where: { groupId : id } });
      for (const key of Object.keys(badgeData)) {
        if (badgeData[key] === true) { // 칼럼 값이 true인지 확인
          badges.push(key); // true인 경우 칼럼 이름을 배열에 추가
        }
      }
      const { password, badgeCount, ...groupWithoutPasswords } = updatedGroup;
      const groupResponse = {...groupWithoutPasswords, badges};
      res.status(200).send(groupResponse);
    } else { 
      res.status(403).send({"message": "비밀번호가 틀렸습니다"}) 
    }
  }))


  //그룹 삭제
  .delete(asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const group = await req.prisma.group.findUnique({
      where: { id },
    });
    
    //그룹 존재하지 않음 : 404 반환
    if(!group) { 
      return res.status(404).send({"message": "존재하지 않습니다"})
    }

    //그룹 존재 - 비밀번호 맞으면 200, 틀리면 403 반환
    if(req.body.password === group.password){
      await req.prisma.group.delete({
        where: { id },
      });
      res.status(200).send({"message": "그룹 삭제 성공"});
    } else { 
      res.status(403).send({"message": "비밀번호가 틀렸습니다"}) 
    }
  }));


//그룹 공개 여부 확인
groupRouter.get('/:id/is-public', (async (req, res) => {
  const id = Number(req.params.id);
  const group = await req.prisma.group.findUnique({
    where: { id },
  });
  res.status(200).send({id:id, isPublic: group.isPublic});
}));


//그룹 조회 권한 확인
groupRouter.post('/:id/verify-password', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const group = await req.prisma.group.findUnique({
    where: { id },
  });
  if(req.body.password === group.password){
    res.status(200).send({"message": "비밀번호가 확인되었습니다"});
  } else {
    res.status(401).send({"message": "비밀번호가 틀렸습니다"});
  }
}));

//그룹 공감하기
groupRouter.post('/:id/like', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const group = await req.prisma.group.findUnique({
    where: { id },
  });
  if (group) {
    if (group.likeCount + 1 >= 10000) {
      const groupBadge = await req.prisma.badge.findUnique({
        where: { id },
        select: { badge4: true },
      });
      
      if (groupBadge && !groupBadge.badge4) {
        await req.prisma.badge.update({
          where: { id },
          data: { badge4: true },
        });
        
        await req.prisma.group.update({
          where: { id },
          data: { badgeCount: { increment: 1 } }, 
        });
      }
    } 
  await req.prisma.group.update({
    where: { id },
    data: { likeCount : {increment: 1,}},
  });
  res.status(200).send({"message": "그룹 공감하기 성공"});
  } else {res.status(404).send({"message": "존재하지 않습니다"}) }
}));

setInterval(async () => {
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const oldGroups = await req.prisma.group.findMany({
    where: {
      createdAt: {
        lt: oneYearAgo,
      },
    },
  });

  for (const group of oldGroups) {
    await req.prisma.group.update({
      where: { id: group.id },
      data: { badgeCount: { increment: 1 } },   
    }); 

    await req.prisma.badge.update({
      where: { id: group.id },
      data: { badge3: true },
    });
  } 
}, 30*60*1000);

export default groupRouter;