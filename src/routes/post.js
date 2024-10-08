import * as dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import { Prisma } from '@prisma/client';

const postRouter = express.Router();

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

postRouter.route('/groups/:id/posts')
  // 게시글 등록
  .post(asyncHandler(async (req, res) => {
    const groupId = Number(req.params.id);
    const postData = { ...req.body, groupId};

    const newPost = await req.prisma.post.create({
      data: postData,
    });

    const updatedGroup = await req.prisma.group.update({
      where: { id: groupId },
      data: { postCount: { increment: 1 } }, 
    });

    const group = await req.prisma.group.findUnique({
      where: { id: groupId },
      select: { badges: true, postCount: true, createdAt: true },
    });

    const currentDate = new Date();
    let daysHavePosts = true;

    for (let i = 0; i < 7; i++) {
      const dateCheck = new Date(currentDate);
      dateCheck.setDate(currentDate.getDate() - i);

      const postCountOnDay = await req.prisma.post.count({
        where: {
            groupId,
            createdAt: {
            gte: new Date(dateCheck.setHours(0, 0, 0, 0)), 
            lt: new Date(dateCheck.setHours(23, 59, 59, 999)), 
            },
          },
      });

      if (postCountOnDay === 0) {
        daysHavePosts = false;
        break;
      }
    }

    if (daysHavePosts) {
      const groupBadge = await req.prisma.badge.findUnique({
        where: { groupId },
        select: { badge1: true },  
      });

      if (groupBadge && !groupBadge.badge1) {
        await req.prisma.badge.update({
          where: { groupId },
          data: { badge1: true },  
        });

        await req.prisma.group.update({
          where: { id: groupId },
          data: { badgeCount: { increment: 1 } },   
        });
      }
    }

    if (updatedGroup.postCount >= 20 ) {
      const groupBadge = await req.prisma.badge.findUnique({
        where: { groupId },
        select: { badge2: true }, 
      });

      if (groupBadge && !groupBadge.badge2) {
        await req.prisma.badge.update({
          where: { groupId },
          data: { badge2: true },  
        });

        await req.prisma.group.update({
          where: { id: groupId },
          data: { badgeCount: { increment: 1 } },   
        });
      }
    }

    const { postPassword: ppwd, groupPassword: gpwd, ...postWithoutPasswords } = newPost;
    res.status(200).send(postWithoutPasswords);
  }))



  // 게시글 목록 조회
  .get(asyncHandler(async (req, res) => {
    const { page = 1, pageSize = 10, sortBy = 'latest', keyword, isPublic = true} = req.query;
    const currentPage = Number(page);
    const itemsPerPage = Number(pageSize);
    const isPublicFilter = isPublic === 'false' ? false : true;
    const groupId  = Number(req.params.id);

    let orderBy;
    switch (sortBy) {
      case 'mostCommented':
        orderBy = {commentCount: 'desc'};
        break;
      case 'mostLiked':
        orderBy = {likeCount: 'desc'};
        break;
      case 'latest':
      default:
        orderBy = {createdAt: 'desc'};
    }

    // 필터링 조건 설정
    const where = {
      groupId: groupId,
      isPublic: isPublicFilter,
    };
   
    // keyword가 있을 때만 OR 조건 추가
    if (keyword) {
      where.OR = [
        { title: { contains: keyword } },
        { tags: { array_contains: keyword } },
      ];
    }

    const posts = await req.prisma.post.findMany({
      where,
      orderBy,  
      skip: (currentPage - 1) * itemsPerPage, 
      take: itemsPerPage,  
      select: {
        id: true,
        nickname: true,
        title: true,
        imageUrl: true,
        tags: true,
        location: true,
        moment: true,
        isPublic: true,
        likeCount: true,
        commentCount: true,
        createdAt: true,
      },
    });

    const totalItemCount = await req.prisma.post.count({ where });

    const totalPages = Math.ceil(totalItemCount / itemsPerPage);

    const postResponse = {
      currentPage,
      totalPages,
      totalItemCount,
      data: posts,
    };
    res.status(200).send(postResponse);
  }));


postRouter.route('/posts/:id')
  // 게시글 상세 정보 조회
  .get(asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const post = await req.prisma.post.findUnique({
      where: { id },
      include: {
        comments: true,
      },
    });

    const { postPassword, groupPassword, ...postWithoutPasswords } = post;
    res.status(200).send(postWithoutPasswords);
  }))

  // 게시글 수정
  .put(asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const password = req.body.postPassword;
    const post = await req.prisma.post.findUnique({
      where: { id },
    });

    if (!post) {
      return res.status(404).send({ message: '존재하지 않습니다' });
    }

    if (post.postPassword === password) {
      const updatedPost = await req.prisma.post.update({
        where : { id },
        data: req.body,
      });

      const { postPassword, ...postWithoutPassword } = updatedPost;
      res.status(200).send(postWithoutPassword);
    } else {
      res.status(403).send({ message: '비밀번호가 틀렸습니다' });
    } 
  })) 

  // 게시글 삭제
  .delete(asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const password = req.body.postPassword;
    const post = await req.prisma.post.findUnique({
      where: { id },
    });

    if (!post) {
      return res.status(404).send({ message: '존재하지 않습니다' });
    }

    if ( post.postPassword === password) {
      await req.prisma.post.delete({
        where: { id }, 
      });
      
      await req.prisma.group.update({
        where: { id: post.groupId },
        data: { postCount: { decrement: 1 } },
      });
      
      res.status(200).send({ message: '게시글 삭제 성공' });
    } else {
      res.status(403).send({ message: '비밀번호가 틀렸습니다' });
    } 
  }));



// 게시글 조회 권한 확인
postRouter.post('/posts/:id/verify-password', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const password = req.body.postPassword;
  const post = await req.prisma.post.findUnique({
    where: { id },
  });
  if (post.postPassword === password) {
    res.status(200).send({ message: '비밀번호가 확인되었습니다' });
  } else {
    res.status(401).send({ message: '비밀번호가 틀렸습니다' });
  }
}));



// 게시글 공감하기
postRouter.post('/posts/:id/like', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const post = await req.prisma.post.findUnique({
    where: { id },
  });

  if (post) {
    await req.prisma.post.update({
      where: { id },
      data: { likeCount: {increment: 1,}}, 
    });

    if (post.likeCount + 1 >= 10000) {
      const groupId = post.groupId;
      const groupBadge = await req.prisma.badge.findUnique({
        where: { groupId },
        select: { badge5: true },
      });

    if (groupBadge && !groupBadge.badge5) {
      await req.prisma.badge.update({
        where: { groupId },
        data: { badge5: true },
      });

      await req.prisma.group.update({
        where: { id: groupId },
        data: { badgeCount: { increment: 1 } }, 
      });
    }
  }
    res.status(200).send({ message: '게시글 공감하기 성공' });
  } else {
    res.status(404).send({ message: '존재하지 않습니다' });
  }
}));



// 게시글 공개 여부
postRouter.get('/posts/:id/is-public', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const post = await req.prisma.post.findUnique({
    where: { id },
  });
  if (post) {
    res.status(200).send({ id: post.id, isPublic: post.isPublic });
  } 
}));


export default postRouter;
