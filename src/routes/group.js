import * as dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import { PrismaClient, Prisma} from '@prisma/client';

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

//그룹 목록 조회
app.get('/api/groups',  asyncHandler (async (req, res) => {
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

  const groups = await prisma.group.findMany({
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
  
  const totalItemCount = await prisma.group.count({
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
}));



//그룹 상세 정보 조회
app.get('/api/groups/:id', asyncHandler(async (req, res) => {
  // 비공개 그룹일 경우 조회 권한 확인 api 사용 
  const id = Number(req.params.id);
  const group = await prisma.group.findUnique({
    where: { id },
    include:{ 
      posts : true 
    },
    //badges [] 추가
  })
  const { password, badgeCount, ...groupWithoutPasswords } = group;
  res.status(200).send(groupWithoutPasswords);
}));
 


//그룹 등록
app.post('/api/groups', asyncHandler(async (req, res) => {
  const newGroup = await prisma.group.create({
    //배열 반환
    data: req.body,
  });
  const { password : gpwd, badgeCount : bct, ...groupWithoutPasswords } = newGroup;
  res.status(201).send(groupWithoutPasswords);
}));

//그룹 수정
app.put('/api/groups/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const group = await prisma.group.findUnique({
    where: { id },
  });
  
  //그룹 존재하지 않음 : 404 반환
  if(!group) { 
    return res.status(404).send({"message": "존재하지 않습니다"})
  }
  
  //그룹 존재 : 비밀번호 맞으면 200, 틀리면 403 반환
  if(req.body.password === group.password){
    const updatedGroup = await prisma.group.update({
      where: { id },
      data: req.body,
    });
    const { password, badgeCount, ...groupWithoutPasswords } = updatedGroup;
    res.status(200).send(groupWithoutPasswords);
  } else { 
    res.status(403).send({"message": "비밀번호가 틀렸습니다"}) 
  }
}));


//그룹 삭제
app.delete('/api/groups/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const group = await prisma.group.findUnique({
    where: { id },
  });
  
  //그룹 존재하지 않음 : 404 반환
  if(!group) { 
    return res.status(404).send({"message": "존재하지 않습니다"})
  }

  //그룹 존재 - 비밀번호 맞으면 200, 틀리면 403 반환
  if(req.body.password === group.password){
    await prisma.group.delete({
      where: { id },
    });
    res.status(200).send({"message": "그룹 삭제 성공"});
  } else { 
    res.status(403).send({"message": "비밀번호가 틀렸습니다"}) 
  }
}));


//그룹 공개 여부 확인
app.get('/api/groups/:id/is-public', (async (req, res) => {
  const id = Number(req.params.id);
  const group = await prisma.group.findUnique({
    where: { id },
  });
  res.status(200).send({id:id, isPublic: group.isPublic});
}));


//그룹 조회 권한 확인
app.post('/api/groups/:id/verify-password', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const group = await prisma.group.findUnique({
    where: { id },
  });
  if(req.body.password === group.password){
    res.status(200).send({"message": "비밀번호가 확인되었습니다"});
  } else {
    res.status(401).send({"message": "비밀번호가 틀렸습니다"});
  }
}));

//그룹 공감하기
app.post('/api/groups/:id/like', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const group = await prisma.group.findUnique({
    where: { id },
  });
  if (group) {
    await prisma.group.update({
      where: { id },
      data: { likeCount : {increment: 1,}},
    });
    res.status(200).send({"message": "그룹 공감하기 성공"});
  } else {res.status(404).send({"message": "존재하지 않습니다"}) }
}));

//404페이지 띄우기, 일단 주석처리해놓음
/*
app.use((req,res)=>{
  res.sendFile(__dirname + "/404.html");
})
*/

app.listen(3000, () => { console.log('Server Started'); });