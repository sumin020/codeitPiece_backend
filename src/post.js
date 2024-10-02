import * as dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();


const app = express();
app.use(express.json());

function asyncHandler(handler) {
  return async function (req, res) {
    try {
      await handler(req, res);
    } catch (e) {
      if (e.name === 'ValidationError' 
        || e instanceof Prisma.PrismaClientValidationError) {
        res.status(400).send({ message: "잘못된 요청입니다" });
      //if (e.name === 'StructError' ||
      //    e instanceof Prisma.PrismaClientValidationError)
      // 위 코드는 유효성 검사 실시하면 다시 생각해봄
      }
    };
  }
}



// 게시글 등록
app.post('/api/groups/:id/posts', asyncHandler(async (req, res) => {
  const groupId = Number(req.params.id);
  const postData = { ...req.body, groupId};

  // 새 게시글 생성
  const newPost = await prisma.post.create({
    data: postData,
  });

  // 그룹의 게시물 수(postCount) + 1
  const updatedGroup = await prisma.group.update({
    where: { id: groupId },
    data: { postCount: { increment: 1 } }, 
  });

  // group의 뱃지 찾기
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { badges: true, postCount: true, createdAt: true },
  });

  // 7일 연속 게시글 등록 확인
  const currentDate = new Date();
  let allDaysHavePosts = true;

  for (let i = 0; i < 7; i++) {
   const dateCheck = new Date(currentDate);
   dateCheck.setDate(currentDate.getDate() - i);

    const postCountOnDay = await prisma.post.count({
     where: {
        groupId,
        createdAt: {
         gte: new Date(dateCheck.setHours(0, 0, 0, 0)), 
         lt: new Date(dateCheck.setHours(23, 59, 59, 999)), 
        },
     },
   });

    // 만약 하루라도 게시글이 없다면 7일 연속 조건을 만족하지 않음
    if (postCountOnDay === 0) {
      allDaysHavePosts = false;
     break;
    }
  }

  // 7일 연속 게시글 등록시 뱃지 1 추가 및 badgeCount 증가
  if (allDaysHavePosts && !group.badges.includes("Badge 1")) {
   await prisma.group.update({
      where: { id: groupId },
      data: {
        badges: { push: "Badge 1" }, 
       badgeCount: { increment: 1 }, 
     },
    });
  }

  // 게시글 수 20개 이상 등록시 뱃지 2 추가 및 badgeCount 증가
  if (updatedGroup.postCount >= 20 && !group.badges.includes("Badge 2")) {
    await prisma.group.update({
      where: { id: groupId },
      data: {
        badges: { push: "Badge 2" }, 
        badgeCount: { increment: 1 }, 
      },
    });
  }

  // password 제외
  const { postPassword: ppwd, groupPassword: gpwd, ...postWithoutPasswords } = newPost;
  res.status(200).send(postWithoutPasswords);
}));



// 게시글 목록 조회
app.get('/api/groups/:id/posts', asyncHandler(async (req, res) => {
  const { page = 1, pageSize = 10, sortBy = 'latest', keyword, isPublic = true} = req.query;

  const currentPage = Number(page);
  const itemsPerPage = Number(pageSize);
  const isPublicFilter = isPublic === 'false' ? false : true;

  let orderBy = {};
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


  const posts = await prisma.post.findMany({
    where: {
       groupId: Number(req.params.groupId),  
       isPublic: isPublicFilter, 
       OR: [
         { title: { contains: keyword } }, 
         { tags: { has: keyword } },         
       ],
     },
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

  const totalItemCount = await prisma.post.count({
    where: {
       groupId: Number(req.params.groupId),        
       isPublic: isPublicFilter,
      OR: [
         { title: { contains: keyword } },
         { tags: { has: keyword } },
       ],
    },    
  });

  const totalPages = Math.ceil(totalItemCount / itemsPerPage);

   const postResponse = {
    currentPage,
    totalPages,
     totalItemCount,
     data: posts,
  };

  res.status(200).json(postResponse);

  
}));



// 게시글 상세 정보 조회
app.get('/api/posts/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const post = await prisma.post.findUnique({
    where: { id },
    include: {
      comments: true,
    },
  });

  const { postPassword, groupPassword, ...postWithoutPasswords } = post;
  res.status(200).send(postWithoutPasswords);
}));



// 게시글 수정
app.put('/api/posts/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const password = req.body.postPassword;
  const post = await prisma.post.findUnique({
    where: { id },
  });

  if (!post) {
    return res.status(404).send({ message: '존재하지 않습니다' });
  }

  if (post.postPassword === password) {
    const updatedPost = await prisma.post.update({
      where : { id },
      data: req.body,
    });

    const { postPassword, ...postWithoutPassword } = updatedPost;
    res.status(200).send(postWithoutPassword);
  } else {
    res.status(403).send({ message: '비밀번호가 틀렸습니다' });
  } 
}));



// 게시글 삭제
app.delete('/api/posts/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const password = req.body.postPassword;
  const post = await prisma.post.findUnique({
    where: { id },
  });

  if (!post) {
    return res.status(404).send({ message: '존재하지 않습니다' });
  }

  if ( post.postPassword === password) {
    await prisma.post.delete({
      where: { id }, 
    });

    await prisma.group.update({
      where: { id: post.groupId },
      data: { postCount: { decrement: 1 } },
    });

    res.status(200).send({ message: '게시글 삭제 성공' });
  } else {
    res.status(403).send({ message: '비밀번호가 틀렸습니다' });
  } 
}));



// 게시글 조회 권한 확인
app.post('/api/posts/:id/verify-password', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const password = req.body.postPassword;
  const post = await prisma.post.findUnique({
    where: { id },
  });
  if (post.postPassword === password) {
    res.status(200).send({ message: '비밀번호가 확인되었습니다' });
  } else {
    res.status(401).send({ message: '비밀번호가 틀렸습니다' });
  }
}));



// 게시글 공감하기
app.post('/api/posts/:id/like', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const post = await prisma.post.findUnique({
    where: { id },
  });

  if (post) {
    // 게시글 공감 수 증가
    await prisma.post.update({
      where: { id },
      data: { likeCount: {increment: 1,}}, 
    });
    
    // Badge 5가 존재하지 않으면서 공감수가 10000이 넘으면 Badge 5 추가
    if (post.likeCount + 1 >= 10000 && !group.badges.includes("Badge 3")) {
      const groupId = post.groupId;

      const groupBadges = await prisma.group.findUnique({
        where: { id: groupId },
        select: { badges: true },
      });
      
      // Badge 5 추가 및 badgeCount 증가
      await prisma.group.update({
        where: { id: groupId },
        data: {
          badges: { push: "Badge 3" }, 
          badgeCount: { increment: 1 },
        },
      });

    }
    res.status(200).send({ message: '게시글 공감하기 성공' });
  } else {
    res.status(404).send({ message: '존재하지 않습니다' });
  }
}));



// 게시글 공개 여부
app.get('/api/posts/:id/is-public', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const post = await prisma.post.findUnique({
    where: { id },
  });
  if (post) {
    res.status(200).send({ id: post.id, isPublic: post.isPublic });
  } 
}));



// 댓글 등록
app.post('/api/posts/:id/comments', asyncHandler(async (req, res) => {
  const postId = Number(req.params.id);
  const commentData = { ...req.body, postId };

  const newComment = await prisma.comment.create({
    data: commentData,
  });

  await prisma.post.update({
    where: { id: postId },
    data: { commentCount: { increment: 1 } },
  });

  const { password: pwd, ...commentWithoutPassword } = newComment;
  res.status(200).send(commentWithoutPassword);
}));



// 댓글 수정
app.put('/api/comments/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const password = req.body.password;
  const comment = await prisma.comment.findUnique({
    where: { id },
  });

  if (!comment) {
    return res.status(404).send({ message: '존재하지 않습니다' });
  }

  if (comment.password === password) {
    const updatedComment = await prisma.comment.update({
      where : { id },
      data: req.body,
    });

    const { password, ...commentWithoutPassword } = updatedComment;
    res.status(200).send(commentWithoutPassword);
  } else {
    res.status(403).send({ message: '비밀번호가 틀렸습니다' });
  } 

}));



// 댓글 삭제
app.delete('/api/comments/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const password = req.body.password;
  const comment = await prisma.comment.findUnique({
    where: { id },
  });

  if (!comment) {
    return res.status(404).send({ message: '존재하지 않습니다' });
  }

  if (comment.password === password) {
    await prisma.comment.delete({
      where: { id }, 
    });
  
    await prisma.post.update({
      where: { id: comment.postId },
      data: { commentCount: { decrement: 1 } },
    });
  
    res.status(200).send({ message: '답글 삭제 성공' });
  } else {
    res.status(403).send({ message: '비밀번호가 틀렸습니다' });
  } 
}));




app.listen(3000, () => { console.log('Server Started'); });